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

    CREATE TABLE IF NOT EXISTS app_user (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
      role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'trader')),
      created_at timestamptz NOT NULL DEFAULT now(),
      password_changed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS user_session (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES app_user(id),
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS user_session_user_idx ON user_session (user_id);
    CREATE TABLE IF NOT EXISTS audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor text NOT NULL,
      action text NOT NULL,
      subject text,
      detail jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cricket_match (
      match_id text PRIMARY KEY,
      competition text NOT NULL,
      name text NOT NULL,
      starts_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'inplay', 'suspended', 'closed')),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS raw_ball_event (
      id bigserial PRIMARY KEY,
      match_id text NOT NULL REFERENCES cricket_match(match_id),
      sequence int NOT NULL,
      innings int NOT NULL,
      over int NOT NULL,
      ball_in_over int NOT NULL,
      runs_off_bat int NOT NULL,
      extras int NOT NULL,
      is_wicket boolean NOT NULL,
      is_legal boolean NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (match_id, sequence)
    );
  `.execute(db);
}
