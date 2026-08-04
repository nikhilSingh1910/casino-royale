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

export interface Database {
  ledger_entry: LedgerEntryTable;
  ledger_txn: LedgerTxnTable;
  chip_reservation: ChipReservationTable;
}
