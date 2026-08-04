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

    CREATE TABLE IF NOT EXISTS market (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id text NOT NULL REFERENCES cricket_match(match_id),
      market_type text NOT NULL CHECK (market_type IN ('match_odds', 'bookmaker', 'fancy')),
      name text NOT NULL,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'suspended', 'settled')),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (match_id, market_type, name)
    );
    CREATE TABLE IF NOT EXISTS market_runner (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id uuid NOT NULL REFERENCES market(id) ON DELETE CASCADE,
      runner_name text NOT NULL,
      back_price bigint NOT NULL,
      lay_price bigint NOT NULL,
      UNIQUE (market_id, runner_name)
    );
    CREATE TABLE IF NOT EXISTS fancy_market (
      market_id uuid PRIMARY KEY REFERENCES market(id) ON DELETE CASCADE,
      overs int NOT NULL,
      line_value int NOT NULL,
      back_price bigint NOT NULL,
      lay_price bigint NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS market_config (
      market_type text PRIMARY KEY CHECK (market_type IN ('match_odds', 'bookmaker', 'fancy')),
      enabled boolean NOT NULL DEFAULT true,
      max_stake bigint NOT NULL,
      bet_delay_seconds int NOT NULL DEFAULT 2,
      session_threshold bigint NOT NULL DEFAULT 0
    );
    INSERT INTO market_config (market_type, enabled, max_stake, bet_delay_seconds, session_threshold)
    VALUES ('match_odds', true, 100000, 1, 0),
           ('bookmaker', true, 50000, 2, 0),
           ('fancy', true, 25000, 2, 100000)
    ON CONFLICT (market_type) DO NOTHING;

    CREATE TABLE IF NOT EXISTS bet (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key text NOT NULL UNIQUE,
      user_id uuid NOT NULL REFERENCES app_user(id),
      market_id uuid NOT NULL REFERENCES market(id),
      match_id text NOT NULL REFERENCES cricket_match(match_id),
      reservation_id text NOT NULL,
      side text NOT NULL CHECK (side IN ('back', 'lay')),
      line_value int NOT NULL,
      price bigint NOT NULL,
      stake bigint NOT NULL,
      reserved bigint NOT NULL,
      potential_payout bigint NOT NULL,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'void')),
      placed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS bet_market_open_idx ON bet (market_id) WHERE status = 'open';
    -- D37: runner markets. A bet carries EITHER a line (fancy) or a runner selection (match-odds/bookmaker).
    ALTER TABLE bet ADD COLUMN IF NOT EXISTS runner_id uuid REFERENCES market_runner(id);
    ALTER TABLE bet ALTER COLUMN line_value DROP NOT NULL;
    ALTER TABLE cricket_match ADD COLUMN IF NOT EXISTS result text;

    CREATE TABLE IF NOT EXISTS operator_action (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL CHECK (kind IN ('void', 'resettle')),
      market_id uuid NOT NULL REFERENCES market(id),
      params jsonb NOT NULL,
      proposed_by text NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'rejected')),
      approved_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz
    );
  `.execute(db);
}
