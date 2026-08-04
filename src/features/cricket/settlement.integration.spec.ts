import { Kysely, sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { createDb, Database, migrate } from '../../db';
import { LedgerService } from '../../ledger';
import { AccountService, IdentityRepo } from '../identity';
import { chips } from '../../shared/money';
import { price, winnings } from '../../shared/odds';
import { BetRepo } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';
import { PlacementService } from './placement.service';
import { SettlementService } from './settlement.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';
const LINE = 10;
const BACK = 19500n; // 1.95
const LAY = 21000n; // 2.10

describe('in-play settlement (integration, real Postgres) — CM4', () => {
  let db: Kysely<Database>;
  let ledger: LedgerService;
  let account: AccountService;
  let cricket: CricketRepo;
  let markets: MarketRepo;
  let marketService: MarketService;
  let bets: BetRepo;
  let placement: PlacementService;
  let settlement: SettlementService;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    ledger = new LedgerService(db);
    const identity = new IdentityRepo(db);
    account = new AccountService(identity, ledger);
    cricket = new CricketRepo(db);
    markets = new MarketRepo(db);
    marketService = new MarketService(markets, cricket);
    bets = new BetRepo(db);
    placement = new PlacementService(markets, ledger, account, bets);
    settlement = new SettlementService(markets, bets, cricket, ledger, identity);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, market, market_runner, fancy_market, bet, raw_ball_event, ledger_entry, ledger_txn, chip_reservation, audit_log RESTART IDENTITY CASCADE`.execute(db);
    await sql`UPDATE market_config SET enabled = true, max_stake = 25000, session_threshold = 100000 WHERE market_type = 'fancy'`.execute(db);
  });

  const fundedUser = async (amount: number): Promise<string> => {
    const { id } = await new IdentityRepo(db).createUser(`p_${randomUUID().slice(0, 8)}@x.com`, 'scrypt$aa$bb');
    await ledger.topUp(id, chips(amount), randomUUID());
    return id;
  };

  // A fancy market with a KNOWN line (10) and prices, so outcomes are deterministic, not pricing-dependent.
  const fancyMarket = async (matchId: string): Promise<{ marketId: string; overs: number }> => {
    await cricket.upsertMatch({ matchId, competition: 'T', name: 'A v B', startsAt: new Date('2026-08-05T08:00:00Z') });
    await marketService.createMarketsForMatch(matchId, ['A', 'B']);
    const list = await marketService.getMarkets(matchId);
    const marketId = list.find((x) => x.name === '6 over runs')?.id ?? '';
    const detail = await markets.getMarketWithFancy(marketId);
    const overs = detail?.fancy?.overs ?? 6;
    await markets.setFancy(marketId, overs, LINE, BACK, LAY);
    return { marketId, overs };
  };

  const placeBack = (userId: string, marketId: string, stake: number) =>
    placement.placeBet({ userId, marketId, side: 'back', stake: chips(stake), seenLineValue: LINE, seenPrice: BACK, idempotencyKey: randomUUID() });
  const placeLay = (userId: string, marketId: string, stake: number) =>
    placement.placeBet({ userId, marketId, side: 'lay', stake: chips(stake), seenLineValue: LINE, seenPrice: LAY, idempotencyKey: randomUUID() });

  // Fill the over window with `overs*6` legal balls; all the runs land on the first ball.
  let seq = 0;
  const ingestWindow = async (matchId: string, overs: number, totalRuns: number): Promise<void> => {
    for (let o = 0; o < overs; o += 1) {
      for (let b = 0; b < 6; b += 1) {
        seq += 1;
        await cricket.appendBall({ matchId, sequence: seq, innings: 1, over: o, ballInOver: b + 1, runsOffBat: o === 0 && b === 0 ? totalRuns : 0, extras: 0, isWicket: false, isLegal: true });
      }
    }
  };
  // A third-umpire penalty: extra runs, no legal ball bowled — append-only, doesn't change completeness.
  const awardPenalty = async (matchId: string, runs: number): Promise<void> => {
    seq += 1;
    await cricket.appendBall({ matchId, sequence: seq, innings: 1, over: 0, ballInOver: 0, runsOffBat: 0, extras: runs, isWicket: false, isLegal: false });
  };
  beforeEach(() => {
    seq = 0;
  });

  const balances = async (u: string) => {
    const b = await ledger.balance(u);
    return { available: b.available as bigint, reserved: b.reserved as bigint };
  };
  const expectBalanced = async () => {
    const r = await ledger.verifyIntegrity();
    expect(r.sumsToZero).toBe(true);
    expect(r.reservedMatchesOpenReservations).toBe(true);
  };

  it('a back bet whose line is reached is paid from the ledger', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s1');
    await placeBack(u, marketId, 100);
    await ingestWindow('s1', overs, 20); // 20 ≥ line 10 → back wins

    const res = await settlement.settleFancyMarket(marketId);
    expect(res.status).toBe('settled');
    expect(res.actualRuns).toBe(20);

    const profit = winnings(chips(100), price(BACK)) as bigint; // 95
    expect(await balances(u)).toEqual({ available: 1000n + profit, reserved: 0n });
    expect((await markets.getMarketWithFancy(marketId))?.status).toBe('settled');
    await expectBalanced();

    // a settled market takes no new bets
    await expect(placeBack(u, marketId, 10)).rejects.toThrow(/not open/);
  });

  it('a back bet short of the line loses its stake to the house', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s2');
    await placeBack(u, marketId, 100);
    await ingestWindow('s2', overs, 5); // 5 < 10 → back loses

    const res = await settlement.settleFancyMarket(marketId);
    expect(res.status).toBe('settled');
    expect(await balances(u)).toEqual({ available: 900n, reserved: 0n });
    await expectBalanced();
  });

  it('a lay bet wins when the runs fall short of the line', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s3');
    await placeLay(u, marketId, 100); // reserves the (2.10-1)*100 = 110 liability
    expect((await balances(u)).reserved).toBe(winnings(chips(100), price(LAY)) as bigint);
    await ingestWindow('s3', overs, 5); // 5 < 10 → lay wins

    await settlement.settleFancyMarket(marketId);
    expect(await balances(u)).toEqual({ available: 1100n, reserved: 0n }); // liability back + 100 profit
    await expectBalanced();
  });

  it('does not settle until the window is complete (no fabricated result)', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s4');
    await placeBack(u, marketId, 100);
    await ingestWindow('s4', overs - 1, 20); // one over short of the window

    const res = await settlement.settleFancyMarket(marketId);
    expect(res.status).toBe('pending');
    expect(await balances(u)).toEqual({ available: 900n, reserved: 100n }); // untouched
    expect((await markets.getMarketWithFancy(marketId))?.status).toBe('open'); // not locked
  });

  it('is idempotent — settling twice moves money once', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s5');
    await placeBack(u, marketId, 100);
    await ingestWindow('s5', overs, 20);

    await settlement.settleFancyMarket(marketId);
    const first = await balances(u);
    const again = await settlement.settleFancyMarket(marketId);
    expect(again.status).toBe('already');
    expect(await balances(u)).toEqual(first);
    await expectBalanced();
  });

  it('voids a market and returns every stake, with an audit record', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('s6');
    await placeBack(u, marketId, 100);

    const res = await settlement.voidFancyMarket(marketId, 'trader:alice', 'match abandoned — rain');
    expect(res.settled).toBe(1);
    expect(await balances(u)).toEqual({ available: 1000n, reserved: 0n }); // stake returned
    await expectBalanced();

    const audit = await db.selectFrom('audit_log').select(['actor', 'action', 'subject']).where('action', '=', 'market.void').executeTakeFirst();
    expect(audit).toMatchObject({ actor: 'trader:alice', action: 'market.void', subject: marketId });
  });

  it('resettles a corrected result via one compensating transaction (lost → won)', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s7');
    await placeBack(u, marketId, 100);
    await ingestWindow('s7', overs, 8); // 8 < 10 → back loses
    await settlement.settleFancyMarket(marketId);
    expect(await balances(u)).toEqual({ available: 900n, reserved: 0n }); // lost

    await awardPenalty('s7', 5); // third umpire adds 5 → 13 ≥ 10 → back should have won
    const corrected = await settlement.resettleFancyMarket(marketId, 'trader:bob', 'penalty runs on review', 'corr-1');
    expect(corrected).toEqual([expect.objectContaining({ from: 'lost', to: 'won' })]);

    const profit = winnings(chips(100), price(BACK)) as bigint;
    expect(await balances(u)).toEqual({ available: 1000n + profit, reserved: 0n }); // now paid as a winner
    await expectBalanced(); // reserved untouched, ledger still balances

    // idempotent by correctionId — re-running the same correction moves nothing more
    const again = await settlement.resettleFancyMarket(marketId, 'trader:bob', 'penalty runs on review', 'corr-1');
    expect(again).toEqual([]);
    expect(await balances(u)).toEqual({ available: 1000n + profit, reserved: 0n });
  });

  it('settles due markets across a match from the stored balls', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs } = await fancyMarket('s8');
    await placeBack(u, marketId, 100);
    await ingestWindow('s8', overs, 20);

    const results = await settlement.settleDueMarkets('s8');
    const mine = results.find((r) => r.marketId === marketId);
    expect(mine?.status).toBe('settled');
    expect(await balances(u)).toEqual({ available: 1000n + (winnings(chips(100), price(BACK)) as bigint), reserved: 0n });
    await expectBalanced();
  });
});
