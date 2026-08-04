import { ColumnType, Generated } from 'kysely';

/** Append-only ledger entries. A balance is SUM(amount) per account — never stored (A3.4). */
export interface LedgerEntryTable {
  id: Generated<string>;
  txn_id: string;
  seq: number;
  account: string;
  amount: ColumnType<bigint, bigint, never>;
  created_at: Generated<Date>;
}

/** One row per money-affecting operation. The unique idempotency_key makes retries no-ops (A4.1). */
export interface LedgerTxnTable {
  txn_id: string;
  idempotency_key: string;
  kind: string;
  created_at: Generated<Date>;
}

/** A reservation. Invariant: SUM(amount WHERE status='open') per user == the user's reserved balance. */
export interface ChipReservationTable {
  reservation_id: string;
  user_id: string;
  amount: ColumnType<bigint, bigint, never>;
  status: 'open' | 'settled' | 'released';
  created_at: Generated<Date>;
  closed_at: ColumnType<Date | null, never, Date>;
}

/** A player account (M2). Self-service signup — no agent-issued IDs (D1), no KYC (D32). */
export interface AppUserTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  status: ColumnType<'active' | 'suspended' | 'closed', 'active' | 'suspended' | 'closed' | undefined, 'active' | 'suspended' | 'closed'>;
  role: ColumnType<'player' | 'admin' | 'trader', 'player' | 'admin' | 'trader' | undefined, 'player' | 'admin' | 'trader'>;
  created_at: Generated<Date>;
  password_changed_at: ColumnType<Date, Date | undefined, Date>;
}

/** A session. The token is stored as its SHA-256, so a DB leak yields nothing usable (D34). */
export interface UserSessionTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Generated<Date>;
  revoked_at: ColumnType<Date | null, never, Date>;
}

/** Append-only back-office / security audit (D33 — Postgres, not immudb). */
export interface AuditLogTable {
  id: Generated<string>;
  actor: string;
  action: string;
  subject: ColumnType<string | null, string | null, never>;
  detail: ColumnType<unknown, string | null, never>;
  created_at: Generated<Date>;
}

export interface Database {
  ledger_entry: LedgerEntryTable;
  ledger_txn: LedgerTxnTable;
  chip_reservation: ChipReservationTable;
  app_user: AppUserTable;
  user_session: UserSessionTable;
  audit_log: AuditLogTable;
}
