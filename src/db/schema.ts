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

/** A cricket match (CM1). Status is authoritative-for-display but rebuildable from raw_ball_event. */
export interface CricketMatchTable {
  match_id: string;
  competition: string;
  name: string;
  starts_at: Date;
  status: ColumnType<'scheduled' | 'inplay' | 'suspended' | 'closed', 'scheduled' | 'inplay' | 'suspended' | 'closed' | undefined, 'scheduled' | 'inplay' | 'suspended' | 'closed'>;
  result: ColumnType<string | null, never, string>; // the winning runner name once declared (D37)
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

/** Append-only ball stream — the replayable source of truth (CRICKET-MVP §2.4). Unique per sequence. */
export interface RawBallEventTable {
  id: Generated<string>;
  match_id: string;
  sequence: number;
  innings: number;
  over: number;
  ball_in_over: number;
  runs_off_bat: number;
  extras: number;
  is_wicket: boolean;
  is_legal: boolean;
  received_at: Generated<Date>;
}

export type MarketType = 'match_odds' | 'bookmaker' | 'fancy' | 'ball_by_ball';
export type MarketStatus = 'open' | 'suspended' | 'settled';

/** A betting market on a match (CM2). Grounded in the HAR `market[]` / `fancy[]` model. */
export interface MarketTable {
  id: Generated<string>;
  match_id: string;
  market_type: MarketType;
  name: string;
  status: ColumnType<MarketStatus, MarketStatus | undefined, MarketStatus>;
  created_at: Generated<Date>;
}

/** Runner back/lay prices for match-odds & bookmaker (scaled-integer prices — XC2.5). */
export interface MarketRunnerTable {
  id: Generated<string>;
  market_id: string;
  runner_name: string;
  back_price: ColumnType<bigint, bigint, bigint>;
  lay_price: ColumnType<bigint, bigint, bigint>;
}

/** A session/fancy line (e.g. "6 over runs"): line value + back/lay, repriced per ball. */
export interface FancyMarketTable {
  market_id: string;
  overs: number;
  line_value: ColumnType<number, number, number>;
  back_price: ColumnType<bigint, bigint, bigint>;
  lay_price: ColumnType<bigint, bigint, bigint>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

/** Operator game config per market type (XC2.4) — changeable at runtime, no deploy. */
export interface MarketConfigTable {
  market_type: MarketType;
  enabled: ColumnType<boolean, boolean | undefined, boolean>;
  max_stake: ColumnType<bigint, bigint, bigint>;
  bet_delay_seconds: ColumnType<number, number | undefined, number>;
  session_threshold: ColumnType<bigint, bigint, bigint>;
}

export type BetSide = 'back' | 'lay';
export type BetStatus = 'open' | 'won' | 'lost' | 'void';

/** A placed bet (CM3). Idempotent by placement key; references its ledger reservation. */
export interface BetTable {
  id: Generated<string>;
  idempotency_key: string;
  user_id: string;
  market_id: string;
  match_id: string;
  reservation_id: string;
  side: BetSide;
  line_value: ColumnType<number | null, number | null, never>; // fancy bets carry a struck line
  runner_id: ColumnType<string | null, string | null, never>; // runner bets carry a selection (D37)
  price: ColumnType<bigint, bigint, bigint>;
  stake: ColumnType<bigint, bigint, bigint>;
  reserved: ColumnType<bigint, bigint, bigint>;
  potential_payout: ColumnType<bigint, bigint, bigint>;
  status: ColumnType<BetStatus, BetStatus | undefined, BetStatus>;
  placed_at: Generated<Date>;
}

export type OperatorActionKind = 'void' | 'resettle' | 'settle_match';
export type OperatorActionStatus = 'pending' | 'approved' | 'executed' | 'rejected';

/** A dual-auth (four-eyes) back-office action: proposed by one operator, approved by another (D36). */
export interface OperatorActionTable {
  id: Generated<string>;
  kind: OperatorActionKind;
  market_id: string;
  params: ColumnType<unknown, string, never>;
  proposed_by: string;
  status: ColumnType<OperatorActionStatus, OperatorActionStatus | undefined, OperatorActionStatus>;
  approved_by: ColumnType<string | null, never, string>;
  created_at: Generated<Date>;
  decided_at: ColumnType<Date | null, never, Date>;
}

export interface Database {
  ledger_entry: LedgerEntryTable;
  ledger_txn: LedgerTxnTable;
  chip_reservation: ChipReservationTable;
  app_user: AppUserTable;
  user_session: UserSessionTable;
  audit_log: AuditLogTable;
  cricket_match: CricketMatchTable;
  raw_ball_event: RawBallEventTable;
  market: MarketTable;
  market_runner: MarketRunnerTable;
  fancy_market: FancyMarketTable;
  market_config: MarketConfigTable;
  bet: BetTable;
  operator_action: OperatorActionTable;
}
