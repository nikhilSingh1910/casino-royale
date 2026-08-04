import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import { Database } from './schema';

// Parse int8 (OID 20) as bigint so chip amounts never lose precision.
types.setTypeParser(20, (v) => BigInt(v));

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

/** Idempotent DDL (M1). A real migration tool arrives if the schema grows; this is enough now. */
export async function migrate(db: Kysely<Database>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_txn (
      txn_id text PRIMARY KEY,
      idempotency_key text NOT NULL UNIQUE,
      kind text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ledger_entry (
      id bigserial PRIMARY KEY,
      txn_id text NOT NULL REFERENCES ledger_txn(txn_id),
      seq int NOT NULL,
      account text NOT NULL,
      amount bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ledger_entry_account_idx ON ledger_entry (account);
    CREATE TABLE IF NOT EXISTS chip_reservation (
      reservation_id text PRIMARY KEY,
      user_id text NOT NULL,
      amount bigint NOT NULL,
      status text NOT NULL CHECK (status IN ('open', 'settled', 'released')),
      created_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS chip_reservation_open_idx
      ON chip_reservation (user_id) WHERE status = 'open';
  `.execute(db);
}
