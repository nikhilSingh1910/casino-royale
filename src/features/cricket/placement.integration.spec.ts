import { Kysely, sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { createDb, Database, migrate } from '../../db';
import { LedgerService } from '../../ledger';
import { AccountService, IdentityRepo } from '../identity';
import { chips } from '../../shared/money';
import { BetRepo } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';
import { BetRejectedError, PlacementService } from './placement.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('bet placement (integration, real Postgres) — CM3', () => {
  let db: Kysely<Database>;
  let ledger: LedgerService;
  let account: AccountService;
  let cricketRepo: CricketRepo;
  let marketRepo: MarketRepo;
  let marketService: MarketService;
  let betRepo: BetRepo;
  let placement: PlacementService;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    ledger = new LedgerService(db);
    account = new AccountService(new IdentityRepo(db), ledger);
    cricketRepo = new CricketRepo(db);
    marketRepo = new MarketRepo(db);
    marketService = new MarketService(marketRepo, cricketRepo);
    betRepo = new BetRepo(db);
    placement = new PlacementService(marketRepo, ledger, account, betRepo);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE app_user, cricket_match, ledger_entry, ledger_txn, chip_reservation RESTART IDENTITY CASCADE`.execute(db);
    // Reset config to seed values — another suite mutates max_stake and market_config is not truncated.
    await sql`UPDATE market_config SET enabled = true, max_stake = 25000, bet_delay_seconds = 2, session_threshold = 100000 WHERE market_type = 'fancy'`.execute(db);
  });

  const fundedUser = async (amount: number): Promise<string> => {
    const { id } = await new IdentityRepo(db).createUser(`p_${randomUUID().slice(0, 8)}@x.com`, 'scrypt$aa$bb');
    await ledger.topUp(id, chips(amount), randomUUID());
    return id;
  };

  const fancyMarket = async (matchId: string): Promise<{ marketId: string; line: number; backPrice: bigint }> => {
    await cricketRepo.upsertMatch({ matchId, competition: 'T', name: 'A v B', startsAt: new Date('2026-08-04T08:00:00Z') });
    await marketService.createMarketsForMatch(matchId, ['A', 'B']);
    const markets = await marketService.getMarkets(matchId);
    const fm = markets.find((x) => x.name === '6 over runs');
    const detail = await marketRepo.getMarketWithFancy(fm?.id ?? '');
    return { marketId: fm?.id ?? '', line: detail?.fancy?.line_value ?? 0, backPrice: detail?.fancy?.back_price ?? 0n };
  };

  it('places a back bet and reserves the full stake in the ledger', async () => {
    const u = await fundedUser(1000);
    const { marketId, line, backPrice } = await fancyMarket('m1');

    await placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(100), seenLineValue: line, seenPrice: backPrice, idempotencyKey: randomUUID() });

    const bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(900n);
    expect(bal.reserved as bigint).toBe(100n);
    expect((await placement.customerExposure(u, marketId)) as bigint).toBe(100n);
  });

  it('rejects when the line has moved (two-phase check)', async () => {
    const u = await fundedUser(1000);
    const { marketId, backPrice } = await fancyMarket('m2');
    await expect(
      placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(50), seenLineValue: 99999, seenPrice: backPrice, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(/line moved/);
  });

  it('rejects on a suspended (locked) market', async () => {
    const u = await fundedUser(1000);
    const { marketId, line, backPrice } = await fancyMarket('m3');
    await marketRepo.setStatusForMarket(marketId, 'suspended');
    await expect(
      placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(50), seenLineValue: line, seenPrice: backPrice, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(/not open/);
  });

  it('rejects when chips are insufficient', async () => {
    const u = await fundedUser(10);
    const { marketId, line, backPrice } = await fancyMarket('m4');
    await expect(
      placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(100), seenLineValue: line, seenPrice: backPrice, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(BetRejectedError);
    expect((await ledger.balance(u)).reserved as bigint).toBe(0n); // nothing reserved on rejection
  });

  it('is idempotent — the same placement key reserves once', async () => {
    const u = await fundedUser(1000);
    const { marketId, line, backPrice } = await fancyMarket('m5');
    const key = randomUUID();
    const a = await placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(40), seenLineValue: line, seenPrice: backPrice, idempotencyKey: key });
    const b = await placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(40), seenLineValue: line, seenPrice: backPrice, idempotencyKey: key });
    expect(b.id).toBe(a.id);
    expect((await ledger.balance(u)).reserved as bigint).toBe(40n); // reserved once, not twice
  });

  it('heals a crash between reserve and bet-create without double-reserving', async () => {
    const u = await fundedUser(1000);
    const { marketId, line, backPrice } = await fancyMarket('m7');
    const key = randomUUID();
    // Simulate: the ledger reserve committed, but the process died before bets.create ran.
    await ledger.reserve(u, `bet:${key}`, chips(100), key);
    expect((await ledger.balance(u)).reserved as bigint).toBe(100n);

    // Retry with the same key: must not reserve twice, and the bet must reference the real row.
    await placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(100), seenLineValue: line, seenPrice: backPrice, idempotencyKey: key });
    expect((await ledger.balance(u)).reserved as bigint).toBe(100n); // still once, not 200
    const stored = await db.selectFrom('bet').select('reservation_id').where('idempotency_key', '=', key).executeTakeFirst();
    expect(stored?.reservation_id).toBe(`bet:${key}`);
    const res = await db.selectFrom('chip_reservation').select('reservation_id').where('reservation_id', '=', `bet:${key}`).executeTakeFirst();
    expect(res).toBeTruthy(); // bet.reservation_id points at a chip_reservation that exists
  });

  it('auto-suspends a market that breaches its liability cap', async () => {
    const u = await fundedUser(200000);
    const { marketId, line, backPrice } = await fancyMarket('m6');
    // fancy session_threshold = 100000; back payout per 25000 stake @1.95 = 23750; 5 bets → 118750 > cap
    for (let i = 0; i < 5; i += 1) {
      await placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(25000), seenLineValue: line, seenPrice: backPrice, idempotencyKey: randomUUID() });
    }
    expect((await placement.operatorLiability(marketId)) as bigint).toBeGreaterThan(100000n);
    expect((await marketRepo.getMarketWithFancy(marketId))?.status).toBe('suspended');

    await expect(
      placement.placeBet({ userId: u, marketId, side: 'back', stake: chips(1000), seenLineValue: line, seenPrice: backPrice, idempotencyKey: randomUUID() }),
    ).rejects.toThrow(/not open/);
  });
});
