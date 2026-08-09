import { Test } from '@nestjs/testing';
import { Kysely, sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { Database, KYSELY, migrate } from '../../db';
import { LedgerService } from '../../ledger';
import { ConfigService } from '../../shared/config';
import { chips } from '../../shared/money';
import { price, winnings } from '../../shared/odds';
import { IdentityRepo } from '../identity';
import { CricketModule } from './cricket.module';
import { CricketRepo, MarketService, PlacementService } from './index';
import { LiveTicker } from './live-ticker.service';
import { LiveEvents } from './live-events.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('live ticker (integration, real Postgres) — D43/D46', () => {
  let db: Kysely<Database>;
  let ticker: LiveTicker;
  let cricket: CricketRepo;
  let markets: MarketService;
  let ledger: LedgerService;
  let placement: PlacementService;
  let identity: IdentityRepo;
  let live: LiveEvents;

  beforeAll(async () => {
    const cfg = { get: (k: string) => ({ DATABASE_URL: TEST_URL, NODE_ENV: 'test', FEED_SOURCE: 'fixture', LOG_LEVEL: 'silent', PORT: 3000, LIVE_TICK_MS: 0 })[k] };
    const moduleRef = await Test.createTestingModule({ imports: [CricketModule] }).overrideProvider(ConfigService).useValue(cfg).compile();
    db = moduleRef.get<Kysely<Database>>(KYSELY, { strict: false });
    await migrate(db);
    ticker = moduleRef.get(LiveTicker, { strict: false });
    cricket = moduleRef.get(CricketRepo, { strict: false });
    markets = moduleRef.get(MarketService, { strict: false });
    ledger = moduleRef.get(LedgerService, { strict: false });
    placement = moduleRef.get(PlacementService, { strict: false });
    identity = moduleRef.get(IdentityRepo, { strict: false });
    live = moduleRef.get(LiveEvents, { strict: false });
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, market, market_runner, fancy_market, bet, raw_ball_event, ledger_entry, ledger_txn, chip_reservation, audit_log, operator_action RESTART IDENTITY CASCADE`.execute(db);
  });

  it('brings a scheduled match to life, then advances it a ball per tick', async () => {
    await cricket.upsertMatch({ matchId: 'live1', competition: 'T', name: 'A v B', startsAt: new Date('2026-08-09T08:00:00Z') });
    await markets.createMarketsForMatch('live1', ['A', 'B']);
    expect((await cricket.getMatch('live1'))?.status).toBe('scheduled');

    await ticker.tick(); // no match in-play yet → promote the scheduled one
    expect((await cricket.getMatch('live1'))?.status).toBe('inplay');
    expect(await cricket.ballsFor('live1', 100)).toHaveLength(0);

    await ticker.tick(); // now in-play → one ball
    await ticker.tick(); // → two balls
    const balls = await cricket.ballsFor('live1', 100);
    expect(balls).toHaveLength(2);
    expect(balls[0]?.sequence).toBe(1);
    expect(balls[1]?.sequence).toBe(2);

    // the score endpoint reflects the advancing match
    const score = await markets.getScore('live1');
    expect(score?.innings[0]?.innings).toBe(1);
    expect(score?.recent.length).toBe(2);
  });

  it('auto-settles the match-odds market when the ticker completes a match (D46, P2)', async () => {
    await cricket.upsertMatch({ matchId: 'fm1', competition: 'T', name: 'A v B', startsAt: new Date('2026-08-09T08:00:00Z') });
    await markets.createMarketsForMatch('fm1', ['A', 'B']);
    await cricket.setStatus('fm1', 'inplay');
    const mo = (await markets.getMarkets('fm1')).find((m) => m.market_type === 'match_odds')?.id ?? '';
    const rA = await db.selectFrom('market_runner').select(['id', 'back_price']).where('market_id', '=', mo).where('runner_name', '=', 'A').executeTakeFirstOrThrow();

    const { id: u } = await identity.createUser(`p_${randomUUID().slice(0, 8)}@x.com`, 'scrypt$aa$bb');
    await ledger.topUp(u, chips(1000), randomUUID());
    await placement.placeRunnerBet({ userId: u, marketId: mo, runnerId: rA.id, side: 'back', stake: chips(100), seenPrice: rA.back_price, idempotencyKey: randomUUID() });

    // Drive the match to completion: A (bats first) makes 30 then is all out; B all out for 10 → A defends.
    let s = 0;
    const append = (innings: number, runs: number, wicket = false) =>
      cricket.appendBall({ matchId: 'fm1', sequence: (s += 1), innings, over: Math.floor((s - 1) / 6), ballInOver: ((s - 1) % 6) + 1, runsOffBat: wicket ? 0 : runs, extras: 0, isWicket: wicket, isLegal: true });
    await append(1, 30);
    for (let i = 0; i < 10; i += 1) await append(1, 0, true);
    await append(2, 10);
    for (let i = 0; i < 10; i += 1) await append(2, 0, true);

    await ticker.tick(); // matchComplete → derive winner 'A' → settle-match job (inline) → match-odds settles
    expect((await cricket.getMatch('fm1'))?.status).toBe('closed');
    const profit = winnings(chips(100), price(rA.back_price)) as bigint;
    expect((await ledger.balance(u)).available as bigint).toBe(1000n + profit); // the backer of 'A' is paid
    expect((await markets.getMarket(mo))?.status).toBe('settled');
    expect((await ledger.verifyIntegrity()).sumsToZero).toBe(true);
  });

  it('publishes a live event when it advances a match (PC4)', async () => {
    await cricket.upsertMatch({ matchId: 'lp1', competition: 'T', name: 'A v B', startsAt: new Date('2026-08-09T08:00:00Z') });
    await markets.createMarketsForMatch('lp1', ['A', 'B']);
    await cricket.setStatus('lp1', 'inplay');
    const seen: string[] = [];
    const sub = live.stream().subscribe((e) => seen.push(e.matchId));
    await ticker.tick(); // appends a ball → publishes
    sub.unsubscribe();
    expect(seen).toContain('lp1');
  });
});
