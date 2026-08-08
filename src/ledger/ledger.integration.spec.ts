import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import { createDb, Database, migrate } from '../db';
import { chips } from '../shared/money';
import { LedgerService } from './ledger.service';
import { ReservationNotOpenError } from './errors';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('LedgerService (integration, real Postgres) — M1', () => {
  let db: Kysely<Database>;
  let ledger: LedgerService;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    ledger = new LedgerService(db);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE ledger_entry, ledger_txn, chip_reservation RESTART IDENTITY`.execute(db);
  });

  const user = (): string => `u_${randomUUID().slice(0, 8)}`;

  it('top-up → reserve → win moves chips correctly and keeps invariants', async () => {
    const u = user();
    await ledger.topUp(u, chips(1000), randomUUID());
    const rid = randomUUID();
    await ledger.reserve(u, rid, chips(100), randomUUID());

    let bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(900n);
    expect(bal.reserved as bigint).toBe(100n);

    await ledger.settle(rid, 'won', chips(150), randomUUID()); // stake back + 150 winnings
    bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(1150n); // 900 + 100 + 150
    expect(bal.reserved as bigint).toBe(0n);

    const integrity = await ledger.verifyIntegrity();
    expect(integrity.sumsToZero).toBe(true);
    expect(integrity.reservedMatchesOpenReservations).toBe(true);
  });

  it('a lost bet sends the stake to the house', async () => {
    const u = user();
    await ledger.topUp(u, chips(500), randomUUID());
    const rid = randomUUID();
    await ledger.reserve(u, rid, chips(200), randomUUID());
    await ledger.settle(rid, 'lost', chips(0), randomUUID());
    const bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(300n);
    expect(bal.reserved as bigint).toBe(0n);
    expect((await ledger.verifyIntegrity()).sumsToZero).toBe(true);
  });

  it('refuses to reserve more chips than available', async () => {
    const u = user();
    await ledger.topUp(u, chips(100), randomUUID());
    await expect(ledger.reserve(u, randomUUID(), chips(150), randomUUID())).rejects.toThrow(/Insufficient/);
  });

  it('is idempotent — the same key twice moves chips once', async () => {
    const u = user();
    await ledger.topUp(u, chips(100), randomUUID());
    const key = randomUUID();
    const rid = randomUUID();
    const a = await ledger.reserve(u, rid, chips(40), key);
    const b = await ledger.reserve(u, rid, chips(40), key);
    expect(b.replayed).toBe(true);
    expect(b.txnId).toBe(a.txnId);
    expect((await ledger.balance(u)).available as bigint).toBe(60n); // reserved once, not twice
  });

  it('reserve is atomic with its onReserved hook — a throw rolls the reservation back (D44)', async () => {
    const u = user();
    await ledger.topUp(u, chips(100), randomUUID());
    await expect(
      ledger.reserve(u, randomUUID(), chips(40), randomUUID(), async () => {
        throw new Error('hook failed');
      }),
    ).rejects.toThrow('hook failed');
    const bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(100n); // reserve rolled back — nothing moved
    expect(bal.reserved as bigint).toBe(0n);
    expect((await db.selectFrom('chip_reservation').selectAll().execute()).length).toBe(0);
    expect((await ledger.verifyIntegrity()).sumsToZero).toBe(true);
  });

  it('will not settle the same reservation twice', async () => {
    const u = user();
    await ledger.topUp(u, chips(100), randomUUID());
    const rid = randomUUID();
    await ledger.reserve(u, rid, chips(50), randomUUID());
    await ledger.settle(rid, 'void', chips(0), randomUUID());
    await expect(ledger.settle(rid, 'won', chips(10), randomUUID())).rejects.toThrow(ReservationNotOpenError);
  });

  it('serialises concurrent reserves — only what the balance allows succeeds', async () => {
    const u = user();
    await ledger.topUp(u, chips(100), randomUUID());
    // Five concurrent reserves of 30 each against a 100 balance → at most 3 can succeed.
    const attempts = Array.from({ length: 5 }, () =>
      ledger.reserve(u, randomUUID(), chips(30), randomUUID()).then(
        () => 'ok' as const,
        () => 'rejected' as const,
      ),
    );
    const results = await Promise.all(attempts);
    const ok = results.filter((r) => r === 'ok').length;
    expect(ok).toBe(3);

    const bal = await ledger.balance(u);
    expect(bal.available as bigint).toBe(10n); // 100 − 3×30
    expect(bal.reserved as bigint).toBe(90n);
    expect((bal.available as bigint) >= 0n).toBe(true); // never went negative
    const integrity = await ledger.verifyIntegrity();
    expect(integrity.sumsToZero).toBe(true);
    expect(integrity.reservedMatchesOpenReservations).toBe(true);
  });
});
