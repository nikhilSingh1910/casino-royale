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
import {
  BetRejectedError,
  CricketRepo,
  MarketService,
  MatchResultError,
  PlacementService,
  SettlementService,
} from './index';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('cricket end-to-end (integration, real Postgres) — CM6', () => {
  let db: Kysely<Database>;
  let ledger: LedgerService;
  let cricket: CricketRepo;
  let markets: MarketService;
  let placement: PlacementService;
  let settlement: SettlementService;
  let identity: IdentityRepo;

  beforeAll(async () => {
    const testConfig = { get: (k: string) => ({ DATABASE_URL: TEST_URL, NODE_ENV: 'test', FEED_SOURCE: 'fixture', LOG_LEVEL: 'silent', PORT: 3000 })[k] };
    const moduleRef = await Test.createTestingModule({ imports: [CricketModule] })
      .overrideProvider(ConfigService)
      .useValue(testConfig)
      .compile();
    db = moduleRef.get<Kysely<Database>>(KYSELY, { strict: false });
    await migrate(db);
    ledger = moduleRef.get(LedgerService, { strict: false });
    cricket = moduleRef.get(CricketRepo, { strict: false });
    markets = moduleRef.get(MarketService, { strict: false });
    placement = moduleRef.get(PlacementService, { strict: false });
    settlement = moduleRef.get(SettlementService, { strict: false });
    identity = moduleRef.get(IdentityRepo, { strict: false });
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, market, market_runner, fancy_market, bet, raw_ball_event, ledger_entry, ledger_txn, chip_reservation, audit_log, operator_action RESTART IDENTITY CASCADE`.execute(db);
    await sql`UPDATE market_config SET enabled = true WHERE market_type IN ('match_odds', 'bookmaker', 'fancy')`.execute(db);
    seq = 0;
  });

  const fundedUser = async (amount: number): Promise<string> => {
    const { id } = await identity.createUser(`p_${randomUUID().slice(0, 8)}@x.com`, 'scrypt$aa$bb');
    await ledger.topUp(id, chips(amount), randomUUID());
    return id;
  };

  interface MarketRef { id: string; type: string; }
  const buildMatch = async (matchId: string): Promise<MarketRef[]> => {
    await cricket.upsertMatch({ matchId, competition: 'T', name: 'A v B', startsAt: new Date('2026-08-07T08:00:00Z') });
    await markets.createMarketsForMatch(matchId, ['A', 'B']);
    const list = await markets.getMarkets(matchId);
    return list.map((m) => ({ id: m.id, type: m.market_type }));
  };
  const runnersOf = (marketId: string) =>
    db.selectFrom('market_runner').select(['id', 'runner_name', 'back_price', 'lay_price']).where('market_id', '=', marketId).execute();
  const backRunner = async (userId: string, marketId: string, runnerName: string, stake: number) => {
    const r = (await runnersOf(marketId)).find((x) => x.runner_name === runnerName);
    if (!r) throw new Error('no runner');
    return { bet: await placement.placeRunnerBet({ userId, marketId, runnerId: r.id, side: 'back', stake: chips(stake), seenPrice: r.back_price, idempotencyKey: randomUUID() }), price: r.back_price };
  };
  const backSession = async (userId: string, sessionId: string, stake: number) => {
    const f = (await markets.getMarket(sessionId))?.fancy;
    if (!f) throw new Error('no fancy');
    await placement.placeBet({ userId, marketId: sessionId, side: 'back', stake: chips(stake), seenLineValue: f.line_value, seenPrice: f.back_price, idempotencyKey: randomUUID() });
    return { line: f.line_value, price: f.back_price };
  };

  let seq = 0;
  const ingestSession = async (matchId: string, sessionId: string, totalRuns: number): Promise<void> => {
    const overs = (await markets.getMarket(sessionId))?.fancy?.overs ?? 6;
    for (let o = 0; o < overs; o += 1) {
      for (let b = 0; b < 6; b += 1) {
        seq += 1;
        await cricket.appendBall({ matchId, sequence: seq, innings: 1, over: o, ballInOver: b + 1, runsOffBat: o === 0 && b === 0 ? totalRuns : 0, extras: 0, isWicket: false, isLegal: true });
      }
    }
  };
  const penalty = async (matchId: string, runs: number): Promise<void> => {
    seq += 1;
    await cricket.appendBall({ matchId, sequence: seq, innings: 1, over: 0, ballInOver: 0, runsOffBat: 0, extras: runs, isWicket: false, isLegal: false });
  };

  const bal = async (u: string) => {
    const b = await ledger.balance(u);
    return { available: b.available as bigint, reserved: b.reserved as bigint };
  };
  const profit = (stake: number, backPrice: bigint) => winnings(chips(stake), price(backPrice)) as bigint;
  const expectBalanced = async () => {
    const r = await ledger.verifyIntegrity();
    expect(r.sumsToZero).toBe(true);
    expect(r.reservedMatchesOpenReservations).toBe(true);
  };
  const findMarket = (ms: MarketRef[], type: string) => ms.find((m) => m.type === type)?.id ?? '';

  it('places a runner bet against the live runner price, and rejects a moved price', async () => {
    const u = await fundedUser(1000);
    const ms = await buildMatch('c1');
    const mo = findMarket(ms, 'match_odds');
    await backRunner(u, mo, 'A', 100);
    expect(await bal(u)).toEqual({ available: 900n, reserved: 100n });

    const rA = (await runnersOf(mo)).find((x) => x.runner_name === 'A');
    await expect(
      placement.placeRunnerBet({ userId: u, marketId: mo, runnerId: rA?.id ?? '', side: 'back', stake: chips(50), seenPrice: 99999n, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(/price moved/);
  });

  it('rejects a runner that does not belong to the market', async () => {
    const u = await fundedUser(1000);
    const ms = await buildMatch('c2');
    const mo = findMarket(ms, 'match_odds');
    const bm = findMarket(ms, 'bookmaker');
    const foreignRunner = (await runnersOf(bm)).find((x) => x.runner_name === 'A');
    await expect(
      placement.placeRunnerBet({ userId: u, marketId: mo, runnerId: foreignRunner?.id ?? '', side: 'back', stake: chips(50), seenPrice: foreignRunner?.back_price ?? 0n, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(BetRejectedError);
  });

  it('settles a runner market from the declared result — winner paid, others captured', async () => {
    const backer = await fundedUser(1000);
    const layerLoser = await fundedUser(1000);
    const ms = await buildMatch('c3');
    const mo = findMarket(ms, 'match_odds');
    const { price: pA } = await backRunner(backer, mo, 'A', 100); // backs the eventual winner
    await backRunner(layerLoser, mo, 'B', 100); // backs the loser

    const res = await settlement.settleMatchResult('c3', 'A', 'trader:alice');
    expect(res.find((r) => r.marketId === mo)?.settled).toBe(2);
    expect(await bal(backer)).toEqual({ available: 1000n + profit(100, pA), reserved: 0n }); // paid
    expect(await bal(layerLoser)).toEqual({ available: 900n, reserved: 0n }); // stake to the house
    await expectBalanced();
  });

  it('refuses an invalid result — no market settles, no result is stored (fail loud)', async () => {
    const u = await fundedUser(1000);
    const ms = await buildMatch('c4b');
    const mo = findMarket(ms, 'match_odds');
    await backRunner(u, mo, 'A', 100);
    await expect(settlement.settleMatchResult('c4b', 'Nonexistent', 'trader:alice')).rejects.toThrow(MatchResultError);
    expect(await bal(u)).toEqual({ available: 900n, reserved: 100n }); // untouched
    expect((await markets.getMarket(mo))?.status).toBe('open');
    expect((await cricket.getMatch('c4b'))?.result).toBeNull();
  });

  it('ball-by-ball: back an outcome, settle it by the ball result', async () => {
    const u = await fundedUser(1000);
    const ms = await buildMatch('c9');
    const bbb = findMarket(ms, 'ball_by_ball');
    const runners = await db.selectFrom('market_runner').select(['id', 'runner_name', 'back_price']).where('market_id', '=', bbb).execute();
    expect(runners).toHaveLength(8);
    const four = runners.find((r) => r.runner_name === '4 Runs');
    if (!four) throw new Error('no 4 Runs outcome');

    await placement.placeRunnerBet({ userId: u, marketId: bbb, runnerId: four.id, side: 'back', stake: chips(100), seenPrice: four.back_price, idempotencyKey: randomUUID() });
    expect(await bal(u)).toEqual({ available: 900n, reserved: 100n });

    await settlement.settleOutcome(bbb, '4 Runs', 'trader:alice'); // the ball was a four
    const profit = winnings(chips(100), price(four.back_price)) as bigint;
    expect(await bal(u)).toEqual({ available: 1000n + profit, reserved: 0n });
    await expectBalanced();
  });

  it('voids a runner market and returns every stake', async () => {
    const u = await fundedUser(1000);
    const ms = await buildMatch('c4');
    const bm = findMarket(ms, 'bookmaker');
    await backRunner(u, bm, 'A', 100);
    const res = await settlement.voidMarket(bm, 'trader:bob', 'match abandoned');
    expect(res.settled).toBe(1);
    expect(await bal(u)).toEqual({ available: 1000n, reserved: 0n });
    await expectBalanced();
  });

  it('the full playable path: bets across all three groups, settle each, correct balance', async () => {
    const p = await fundedUser(1000);
    const ms = await buildMatch('c5');
    const mo = findMarket(ms, 'match_odds');
    const bm = findMarket(ms, 'bookmaker');
    const session = ms.find((m) => m.type === 'fancy')?.id ?? '';

    const { price: pMo } = await backRunner(p, mo, 'A', 100);
    const { price: pBm } = await backRunner(p, bm, 'A', 100);
    const { line, price: pSess } = await backSession(p, session, 100);
    expect(await bal(p)).toEqual({ available: 700n, reserved: 300n });

    // Session resolves short of the line first → the session bet loses.
    await ingestSession('c5', session, Math.max(0, line - 2));
    await settlement.settleFancyMarket(session);
    // The match result comes in → both runner markets settle to A (the player's pick).
    await settlement.settleMatchResult('c5', 'A', 'trader:alice');
    expect(await bal(p)).toEqual({ available: 1000n - 100n + profit(100, pMo) + profit(100, pBm), reserved: 0n });
    await expectBalanced();

    // A third-umpire correction flips the session over the line → resettle pays it as a winner.
    await penalty('c5', 5);
    const corrected = await settlement.resettleFancyMarket(session, 'trader:bob', 'penalty on review', 'corr-c5');
    expect(corrected).toEqual([expect.objectContaining({ from: 'lost', to: 'won' })]);
    expect(await bal(p)).toEqual({ available: 1000n + profit(100, pMo) + profit(100, pBm) + profit(100, pSess), reserved: 0n });
    await expectBalanced();
  });
});
