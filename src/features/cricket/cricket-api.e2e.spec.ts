import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Kysely, sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../app.module';
import { Database, KYSELY, migrate } from '../../db';
import { DomainExceptionFilter } from '../../http/domain-exception.filter';
import { LedgerService } from '../../ledger';
import { ConfigService } from '../../shared/config';
import { chips } from '../../shared/money';
import { CricketRepo, MarketService } from './index';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('cricket HTTP API (e2e, real Postgres + Fastify) — web track', () => {
  let app: NestFastifyApplication;
  let db: Kysely<Database>;
  let ledger: LedgerService;
  let cricket: CricketRepo;
  let markets: MarketService;

  beforeAll(async () => {
    const testConfig = { get: (k: string) => ({ DATABASE_URL: TEST_URL, NODE_ENV: 'test', FEED_SOURCE: 'fixture', LOG_LEVEL: 'silent', PORT: 3000 })[k] };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(testConfig)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = moduleRef.get<Kysely<Database>>(KYSELY, { strict: false });
    await migrate(db);
    ledger = moduleRef.get(LedgerService, { strict: false });
    cricket = moduleRef.get(CricketRepo, { strict: false });
    markets = moduleRef.get(MarketService, { strict: false });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy(); // the KYSELY pool is a plain factory value — Nest won't close it for us
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, market, market_runner, fancy_market, bet, raw_ball_event, ledger_entry, ledger_txn, chip_reservation, audit_log, operator_action RESTART IDENTITY CASCADE`.execute(db);
    await sql`UPDATE market_config SET enabled = true WHERE market_type IN ('match_odds', 'bookmaker', 'fancy')`.execute(db);
  });

  const authToken = async (): Promise<{ token: string; userId: string }> => {
    const email = `p_${randomUUID().slice(0, 8)}@x.com`;
    await app.inject({ method: 'POST', url: '/auth/signup', payload: { email, password: 'password1' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password1' } });
    return login.json() as { token: string; userId: string };
  };
  const seedMatch = async (matchId: string): Promise<void> => {
    await cricket.upsertMatch({ matchId, competition: 'IPL', name: 'India v Australia', startsAt: new Date('2026-08-08T08:00:00Z') });
    await markets.createMarketsForMatch(matchId, ['India', 'Australia']);
  };
  const viewOf = async (matchId: string) => (await app.inject({ method: 'GET', url: `/matches/${matchId}` })).json();

  it('GET /matches — empty when none, then lists seeded matches', async () => {
    const empty = await app.inject({ method: 'GET', url: '/matches' });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual([]);

    await seedMatch('w1');
    const res = await app.inject({ method: 'GET', url: '/matches' });
    const list = res.json() as Array<{ id: string; name: string; odds: { home: { back: string } | null; draw: unknown } }>;
    expect(list[0]).toMatchObject({ id: 'w1', name: 'India v Australia' });
    expect(typeof list[0]?.odds.home?.back).toBe('string'); // 1/X/2 top-of-book, prices as strings
    expect(list[0]?.odds.draw).toBeNull(); // 2-runner match → no draw
  });

  it('GET /matches/:id — markets, runners and fancy with prices as strings', async () => {
    await seedMatch('w2');
    const view = await viewOf('w2');
    const mo = view.markets.find((m: { type: string }) => m.type === 'match_odds');
    expect(mo.runners).toHaveLength(2);
    expect(typeof mo.runners[0].back).toBe('string');
    const fancy = view.markets.find((m: { type: string }) => m.type === 'fancy');
    expect(typeof fancy.fancy.back).toBe('string');
    expect(fancy.fancy.overs).toEqual(expect.any(Number));
  });

  it('GET /matches/unknown → 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/matches/nope' })).statusCode).toBe(404);
  });

  it('GET /matches/:id/score — innings totals + current over from the ball store', async () => {
    await seedMatch('w7');
    const balls = [
      { runs: 4, wicket: false },
      { runs: 1, wicket: false },
      { runs: 0, wicket: true },
    ];
    let seq = 0;
    for (const b of balls) {
      seq += 1;
      await cricket.appendBall({ matchId: 'w7', sequence: seq, innings: 1, over: 0, ballInOver: seq, runsOffBat: b.runs, extras: 0, isWicket: b.wicket, isLegal: true });
    }
    const res = await app.inject({ method: 'GET', url: '/matches/w7/score' });
    expect(res.statusCode).toBe(200);
    const s = res.json() as { innings: Array<{ innings: number; team: string; runs: number; wickets: number; overs: string }>; currentOver: Array<{ runs: number; wicket: boolean }> };
    expect(s.innings[0]).toMatchObject({ innings: 1, team: 'India', runs: 5, wickets: 1, overs: '0.3' });
    expect(s.currentOver).toEqual([
      { runs: 4, wicket: false },
      { runs: 1, wicket: false },
      { runs: 0, wicket: true },
    ]);
  });

  it('GET /matches/unknown/score → 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/matches/nope/score' })).statusCode).toBe(404);
  });

  it('POST /bets without a session → 401', async () => {
    expect((await app.inject({ method: 'POST', url: '/bets', payload: {} })).statusCode).toBe(401);
  });

  it('POST /bets — places a fancy bet and reserves chips (userId from the session, not the body)', async () => {
    await seedMatch('w3');
    const { token, userId } = await authToken();
    await ledger.topUp(userId, chips(1000), randomUUID());
    const fancy = (await viewOf('w3')).markets.find((m: { type: string }) => m.type === 'fancy');
    const res = await app.inject({
      method: 'POST',
      url: '/bets',
      headers: { authorization: `Bearer ${token}` },
      payload: { marketId: fancy.id, side: 'back', stake: '100', seenLineValue: fancy.fancy.line, seenPrice: fancy.fancy.back, idempotencyKey: randomUUID() },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ side: 'back', stake: '100', reserved: '100', status: 'open' });
    expect((await ledger.balance(userId)).reserved as bigint).toBe(100n);
  });

  it('POST /runner-bets — places a match-odds bet', async () => {
    await seedMatch('w4');
    const { token, userId } = await authToken();
    await ledger.topUp(userId, chips(1000), randomUUID());
    const mo = (await viewOf('w4')).markets.find((m: { type: string }) => m.type === 'match_odds');
    const runner = mo.runners[0];
    const res = await app.inject({
      method: 'POST',
      url: '/runner-bets',
      headers: { authorization: `Bearer ${token}` },
      payload: { marketId: mo.id, runnerId: runner.id, side: 'back', stake: '100', seenPrice: runner.back, idempotencyKey: randomUUID() },
    });
    expect(res.statusCode).toBe(201);
    expect((await ledger.balance(userId)).reserved as bigint).toBe(100n);
  });

  it('malformed body → 400 validation', async () => {
    const { token } = await authToken();
    const res = await app.inject({ method: 'POST', url: '/bets', headers: { authorization: `Bearer ${token}` }, payload: { side: 'sideways' } });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe('validation');
  });

  it('a zero stake → 400 validation, not a 500 from the ledger', async () => {
    await seedMatch('w6');
    const { token, userId } = await authToken();
    await ledger.topUp(userId, chips(1000), randomUUID());
    const fancy = (await viewOf('w6')).markets.find((m: { type: string }) => m.type === 'fancy');
    const res = await app.inject({
      method: 'POST',
      url: '/bets',
      headers: { authorization: `Bearer ${token}` },
      payload: { marketId: fancy.id, side: 'back', stake: '0', seenLineValue: fancy.fancy.line, seenPrice: fancy.fancy.back, idempotencyKey: randomUUID() },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe('validation');
  });

  it('a moved price → 400 bet_rejected (typed domain error, not a 500)', async () => {
    await seedMatch('w5');
    const { token, userId } = await authToken();
    await ledger.topUp(userId, chips(1000), randomUUID());
    const fancy = (await viewOf('w5')).markets.find((m: { type: string }) => m.type === 'fancy');
    const res = await app.inject({
      method: 'POST',
      url: '/bets',
      headers: { authorization: `Bearer ${token}` },
      payload: { marketId: fancy.id, side: 'back', stake: '100', seenLineValue: fancy.fancy.line, seenPrice: '99999', idempotencyKey: randomUUID() },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe('bet_rejected');
  });
});
