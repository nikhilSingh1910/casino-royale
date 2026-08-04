import { Kysely, sql } from 'kysely';
import { createDb, Database, migrate } from '../../db';
import { LedgerService } from '../../ledger';
import { chips } from '../../shared/money';
import { randomUUID } from 'node:crypto';
import { AccountService, NotEligibleError } from './account.service';
import { AuthError, AuthService } from './auth.service';
import { IdentityRepo } from './identity.repo';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('identity (integration, real Postgres) — M2', () => {
  let db: Kysely<Database>;
  let repo: IdentityRepo;
  let auth: AuthService;
  let account: AccountService;
  let ledger: LedgerService;

  const email = (): string => `p_${randomUUID().slice(0, 8)}@example.com`;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    ledger = new LedgerService(db);
    repo = new IdentityRepo(db);
    auth = new AuthService(repo);
    account = new AccountService(repo, ledger);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE ledger_entry, ledger_txn, chip_reservation, user_session, app_user, audit_log RESTART IDENTITY CASCADE`.execute(db);
  });

  it('signup → login issues a valid session', async () => {
    const e = email();
    const { userId } = await auth.signup(e, 'correct horse');
    const { token, userId: loginId } = await auth.login(e, 'correct horse');
    expect(loginId).toBe(userId);
    const session = await auth.validateSession(token);
    expect(session?.userId).toBe(userId);
  });

  it('rejects a wrong password and an unknown email', async () => {
    const e = email();
    await auth.signup(e, 'correct horse');
    await expect(auth.login(e, 'wrong')).rejects.toThrow(AuthError);
    await expect(auth.login('nobody@example.com', 'whatever')).rejects.toThrow(AuthError);
  });

  it('change-password revokes other sessions but keeps the current one', async () => {
    const e = email();
    await auth.signup(e, 'old password');
    const a = await auth.login(e, 'old password'); // session A (will change pw)
    const b = await auth.login(e, 'old password'); // session B (should be revoked)
    const sessionA = await auth.validateSession(a.token);
    await auth.changePassword(a.userId, sessionA!.sessionId, 'old password', 'new password');

    expect(await auth.validateSession(a.token)).not.toBeNull(); // current stays
    expect(await auth.validateSession(b.token)).toBeNull(); // other revoked
    await expect(auth.login(e, 'old password')).rejects.toThrow(); // old pw dead
    expect((await auth.login(e, 'new password')).token).toBeTruthy(); // new pw works
  });

  it('suspend terminates every session and blocks betting', async () => {
    const e = email();
    const { userId } = await auth.signup(e, 'pw pw pw');
    await ledger.topUp(userId, chips(500), randomUUID());
    const { token } = await auth.login(e, 'pw pw pw');
    await account.assertCanBet(userId); // fine while active + funded

    await auth.suspend('admin', userId);
    expect(await auth.validateSession(token)).toBeNull(); // session killed
    await expect(auth.login(e, 'pw pw pw')).rejects.toThrow(/not active/);
    await expect(account.assertCanBet(userId)).rejects.toThrow(NotEligibleError);

    const audit = await sql<{ n: string }>`SELECT COUNT(*)::text AS n FROM audit_log WHERE action='account_suspended' AND subject=${userId}`.execute(db);
    expect(BigInt(audit.rows[0]?.n ?? '0')).toBe(1n);
  });

  it('assertCanBet needs chips', async () => {
    const { userId } = await auth.signup(email(), 'pw pw pw');
    await expect(account.assertCanBet(userId)).rejects.toThrow(/no chips/);
    await ledger.topUp(userId, chips(10), randomUUID());
    await expect(account.assertCanBet(userId)).resolves.toBeUndefined();
  });

  it('balance and statement reflect the ledger (parity account surface)', async () => {
    const { userId } = await auth.signup(email(), 'pw pw pw');
    await ledger.topUp(userId, chips(1000), randomUUID());
    await ledger.reserve(userId, randomUUID(), chips(250), randomUUID());

    const bal = await account.balance(userId);
    expect(bal.available as bigint).toBe(750n);
    expect(bal.reserved as bigint).toBe(250n);

    const statement = await account.statement(userId, 50);
    expect(statement.length).toBeGreaterThanOrEqual(2); // top-up + reserve movements
    expect(statement[0]?.kind).toBe('reserve'); // newest first
  });
});
