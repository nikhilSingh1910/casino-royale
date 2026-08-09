import { Test } from '@nestjs/testing';
import { Kysely, sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { Database, KYSELY, migrate } from '../../db';
import { LedgerService } from '../../ledger';
import { ConfigService } from '../../shared/config';
import { chips } from '../../shared/money';
import { price, winnings } from '../../shared/odds';
import { CricketRepo, MarketService, MatchResultError, PlacementService, SettlementService } from '../cricket';
import { IdentityRepo } from '../identity';
import { SoDViolationError, ActionNotPendingError } from './errors';
import { TradingModule } from './trading.module';
import { TradingService } from './trading.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';
const ALICE = 'trader:alice';
const BOB = 'trader:bob';

describe('trading console (integration, real Postgres) — CM5', () => {
  let db: Kysely<Database>;
  let ledger: LedgerService;
  let cricket: CricketRepo;
  let marketService: MarketService;
  let placement: PlacementService;
  let settlement: SettlementService;
  let identity: IdentityRepo;
  let trading: TradingService;

  beforeAll(async () => {
    // Point the wired graph at the test DB by overriding the one env reader — no process.env here (C2.1).
    const testConfig = {
      get: (k: string) => ({ DATABASE_URL: TEST_URL, NODE_ENV: 'test', FEED_SOURCE: 'fixture', LOG_LEVEL: 'silent', PORT: 3000 })[k],
    };
    const moduleRef = await Test.createTestingModule({ imports: [TradingModule] })
      .overrideProvider(ConfigService)
      .useValue(testConfig)
      .compile();
    db = moduleRef.get<Kysely<Database>>(KYSELY, { strict: false });
    await migrate(db);
    ledger = moduleRef.get(LedgerService, { strict: false });
    cricket = moduleRef.get(CricketRepo, { strict: false });
    marketService = moduleRef.get(MarketService, { strict: false });
    placement = moduleRef.get(PlacementService, { strict: false });
    settlement = moduleRef.get(SettlementService, { strict: false });
    identity = moduleRef.get(IdentityRepo, { strict: false });
    trading = moduleRef.get(TradingService, { strict: false });
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, market, market_runner, fancy_market, bet, raw_ball_event, ledger_entry, ledger_txn, chip_reservation, audit_log, operator_action RESTART IDENTITY CASCADE`.execute(db);
    await sql`UPDATE market_config SET enabled = true, max_stake = 25000, session_threshold = 100000 WHERE market_type = 'fancy'`.execute(db);
    seq = 0;
  });

  const fundedUser = async (amount: number): Promise<string> => {
    const { id } = await identity.createUser(`p_${randomUUID().slice(0, 8)}@x.com`, 'scrypt$aa$bb');
    await ledger.topUp(id, chips(amount), randomUUID());
    return id;
  };
  const fancyMarket = async (matchId: string): Promise<{ marketId: string; overs: number; line: number; back: bigint }> => {
    await cricket.upsertMatch({ matchId, competition: 'T', name: 'A v B', startsAt: new Date('2026-08-06T08:00:00Z') });
    await marketService.createMarketsForMatch(matchId, ['A', 'B']);
    const list = await marketService.getMarkets(matchId);
    const marketId = list.find((x) => x.name === '6 over runs')?.id ?? '';
    const m = await marketService.getMarket(marketId);
    return { marketId, overs: m?.fancy?.overs ?? 6, line: m?.fancy?.line_value ?? 0, back: m?.fancy?.back_price ?? 0n };
  };
  const placeBack = async (userId: string, marketId: string, stake: number) => {
    const m = await marketService.getMarket(marketId);
    return placement.placeBet({
      userId,
      marketId,
      side: 'back',
      stake: chips(stake),
      seenLineValue: m?.fancy?.line_value ?? 0,
      seenPrice: m?.fancy?.back_price ?? 0n,
      idempotencyKey: randomUUID(),
    });
  };
  let seq = 0;
  const ingestWindow = async (matchId: string, overs: number, totalRuns: number): Promise<void> => {
    for (let o = 0; o < overs; o += 1) {
      for (let b = 0; b < 6; b += 1) {
        seq += 1;
        await cricket.appendBall({ matchId, sequence: seq, innings: 1, over: o, ballInOver: b + 1, runsOffBat: o === 0 && b === 0 ? totalRuns : 0, extras: 0, isWicket: false, isLegal: true });
      }
    }
  };
  const available = async (u: string) => (await ledger.balance(u)).available as bigint;
  const marketStatus = async (id: string) => (await marketService.getMarket(id))?.status;
  const auditRows = (action: string) => db.selectFrom('audit_log').select(['actor', 'action', 'subject']).where('action', '=', action).execute();

  it('suspends and reopens a market through the console, each audited', async () => {
    const { marketId } = await fancyMarket('t1');
    await trading.suspendMarket(marketId, ALICE);
    expect(await marketStatus(marketId)).toBe('suspended');
    await trading.reopenMarket(marketId, ALICE);
    expect(await marketStatus(marketId)).toBe('open');
    expect(await auditRows('market.suspend')).toMatchObject([{ actor: ALICE, subject: marketId }]);
    expect(await auditRows('market.reopen')).toMatchObject([{ actor: ALICE, subject: marketId }]);
  });

  it('voids under four-eyes — a different operator approves and it executes', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('t2');
    await placeBack(u, marketId, 100);

    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE);
    const res = await trading.approve(id, BOB);
    expect(res.kind).toBe('void');
    expect(await available(u)).toBe(1000n); // stake returned
    expect(await marketStatus(marketId)).toBe('settled');

    const action = await db.selectFrom('operator_action').selectAll().where('id', '=', id).executeTakeFirst();
    expect(action).toMatchObject({ status: 'executed', proposed_by: ALICE, approved_by: BOB });
    expect(await auditRows('action.propose.void')).toMatchObject([{ actor: ALICE }]);
    expect(await auditRows('action.approve.void')).toMatchObject([{ actor: BOB }]);
  });

  it('refuses self-approval (segregation of duties)', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('t3');
    await placeBack(u, marketId, 100);

    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE);
    await expect(trading.approve(id, ALICE)).rejects.toThrow(SoDViolationError);
    expect(await available(u)).toBe(900n); // nothing executed
    expect(await marketStatus(marketId)).toBe('open');
    const action = await db.selectFrom('operator_action').select('status').where('id', '=', id).executeTakeFirst();
    expect(action?.status).toBe('pending');
  });

  it('resettles a corrected result under four-eyes', async () => {
    const u = await fundedUser(1000);
    const { marketId, overs, line, back } = await fancyMarket('t4');
    await placeBack(u, marketId, 100);
    await ingestWindow('t4', overs, line - 2); // below the line → loses
    await settlement.settleFancyMarket(marketId);
    expect(await available(u)).toBe(900n);

    seq += 1; // penalty runs (append-only) push it over the line
    await cricket.appendBall({ matchId: 't4', sequence: seq, innings: 1, over: 0, ballInOver: 0, runsOffBat: 0, extras: 5, isWicket: false, isLegal: false });
    const { id } = await trading.propose('resettle', marketId, { reason: 'penalty on review', correctionId: 'c1' }, ALICE);
    await trading.approve(id, BOB);

    const profit = winnings(chips(100), price(back)) as bigint;
    expect(await available(u)).toBe(1000n + profit); // now paid as a winner
  });

  it('declares a match result under four-eyes — match-odds settles and the backer is paid (PC3)', async () => {
    const backer = await fundedUser(1000);
    await fancyMarket('tm1'); // creates every market for the 'A v B' match
    const mo = (await marketService.getMarkets('tm1')).find((m) => m.market_type === 'match_odds');
    const rA = await db.selectFrom('market_runner').select(['id', 'back_price']).where('market_id', '=', mo?.id ?? '').where('runner_name', '=', 'A').executeTakeFirstOrThrow();
    await placement.placeRunnerBet({ userId: backer, marketId: mo?.id ?? '', runnerId: rA.id, side: 'back', stake: chips(100), seenPrice: rA.back_price, idempotencyKey: randomUUID() });
    expect(await available(backer)).toBe(900n);

    const { id } = await trading.proposeMatchResult('tm1', 'A', 'match ended', ALICE);
    await trading.approve(id, BOB); // a different operator approves → executes

    const profit = winnings(chips(100), price(rA.back_price)) as bigint;
    expect(await available(backer)).toBe(1000n + profit); // backer of A is paid
    expect((await marketService.getMarket(mo?.id ?? ''))?.status).toBe('settled');
    expect((await db.selectFrom('operator_action').select('status').where('id', '=', id).executeTakeFirst())?.status).toBe('executed');
  });

  it('rejects declaring a non-runner as the winner (PC3)', async () => {
    await fancyMarket('tm2');
    await expect(trading.proposeMatchResult('tm2', 'Nonexistent', 'no such team', ALICE)).rejects.toThrow(MatchResultError);
  });

  it('exposes the pending queue and the audit trail to operators (PC3b)', async () => {
    const { marketId } = await fancyMarket('tr1');
    await trading.suspendMarket(marketId, ALICE); // an audited action
    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE); // a pending action
    expect((await trading.pendingActions(50)).map((a) => a.id)).toContain(id);
    expect((await trading.recentAudit(100)).some((r) => r.action === 'market.suspend' && r.subject === marketId)).toBe(true);
  });

  it('re-drives an override stranded in approved when its execute-job never persisted (L1)', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('redrive');
    await placeBack(u, marketId, 100);
    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE);
    // Simulate the strand: decide() committed 'approved' but jobs.send threw, so no execute-job exists.
    await db.updateTable('operator_action').set({ status: 'approved', approved_by: BOB, decided_at: new Date() }).where('id', '=', id).execute();
    expect(await marketStatus(marketId)).not.toBe('settled');

    await trading.redriveApprovedOverrides(); // startup reconciliation re-enqueues → executes (inline)

    expect(await marketStatus(marketId)).toBe('settled'); // the void applied
    expect(await available(u)).toBe(1000n); // stake returned
    expect((await db.selectFrom('operator_action').select('status').where('id', '=', id).executeTakeFirst())?.status).toBe('executed');
  });

  it('a rejected action records before/after state, like every back-office action (L2)', async () => {
    const { marketId } = await fancyMarket('rej-audit');
    const { id } = await trading.propose('void', marketId, { reason: 'x' }, ALICE);
    await trading.reject(id, BOB, 'not warranted');
    const row = await db.selectFrom('audit_log').select('detail').where('action', '=', 'action.reject.void').executeTakeFirstOrThrow();
    const detail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail;
    expect(detail).toMatchObject({ before: { status: 'pending', proposedBy: ALICE }, after: { status: 'rejected' }, reason: 'not warranted' });
  });

  it('re-running an approved override is a no-op — durable retry safety (D45b)', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('t9');
    await placeBack(u, marketId, 100);
    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE);
    await trading.approve(id, BOB); // claims 'approved', then executes (inline)
    expect(await available(u)).toBe(1000n);
    expect((await db.selectFrom('operator_action').select('status').where('id', '=', id).executeTakeFirst())?.status).toBe('executed');

    // A duplicate job delivery re-runs the executor — it must not void/refund a second time.
    await trading.executeOverride(id);
    expect(await available(u)).toBe(1000n); // still exactly the stake back, not more
  });

  it('cannot approve the same action twice', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('t5');
    await placeBack(u, marketId, 100);
    const { id } = await trading.propose('void', marketId, { reason: 'rain' }, ALICE);
    await trading.approve(id, BOB);
    await expect(trading.approve(id, ALICE)).rejects.toThrow(ActionNotPendingError);
  });

  it('a rejected action does not execute and cannot then be approved', async () => {
    const u = await fundedUser(1000);
    const { marketId } = await fancyMarket('t6');
    await placeBack(u, marketId, 100);
    const { id } = await trading.propose('void', marketId, { reason: 'mistake' }, ALICE);
    await trading.reject(id, BOB, 'not warranted');
    expect(await available(u)).toBe(900n);
    expect(await marketStatus(marketId)).toBe('open');
    await expect(trading.approve(id, BOB)).rejects.toThrow(ActionNotPendingError);
  });

  it('reports exposure by market, user and match reusing the single-owner formulas', async () => {
    const u = await fundedUser(1000);
    const { marketId, back } = await fancyMarket('t7');
    await placeBack(u, marketId, 100);
    const profit = winnings(chips(100), price(back)) as bigint;
    expect((await trading.exposureByMarket(marketId)) as bigint).toBe(profit); // book pays the winnings on a back
    expect((await trading.exposureByUser(u, marketId)) as bigint).toBe(100n); // user's stake at risk
    expect((await trading.exposureByMatch('t7')) as bigint).toBe(profit);
  });

  it('surfaces a session-market concentration flag', async () => {
    const whale = await fundedUser(2000);
    const minnow = await fundedUser(2000);
    const { marketId } = await fancyMarket('t8');
    await placeBack(whale, marketId, 800);
    await placeBack(minnow, marketId, 200);
    const flags = await trading.integrityFlags(marketId);
    expect(flags).toEqual([{ code: 'user-concentration', userId: whale, shareBps: 8000 }]);
  });
});
