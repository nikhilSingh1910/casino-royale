import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Kysely, Transaction, sql } from 'kysely';
import { Database, KYSELY } from '../db';
import { chips, Chips } from '../shared/money';
import * as L from './core';
import { ReservationNotFoundError, ReservationNotOpenError, ReservationNotSettledError } from './errors';

export type SettleOutcome = L.SettleOutcome; // 'won' | 'lost' | 'void' — matches BetStatus (D35)
export interface OpResult {
  txnId: string;
  replayed: boolean;
}
export interface IntegrityReport {
  sumsToZero: boolean;
  reservedMatchesOpenReservations: boolean;
}
export interface StatementRow {
  account: string;
  amount: Chips;
  kind: string;
  at: Date;
}

/**
 * The one authority on chips (CLAUDE.md §4, §5). The pure core (./core) decides *what* entries an
 * operation produces and *what* preconditions hold; this service persists them in one Postgres
 * transaction, serialised per user by an advisory lock, idempotent by key. D33.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async topUp(userId: string, amount: Chips, idempotencyKey: string): Promise<OpResult> {
    return this.commit(userId, idempotencyKey, 'topUp', () => L.topUp(userId, amount));
  }

  /**
   * Reserve chips, and — atomically in the same transaction — run `onReserved` (D44). Placement uses
   * it to re-check the market and insert the bet, so a reserve can never commit without its bet: if
   * the hook throws, the whole reservation rolls back. Callers with no follow-on work omit it.
   */
  async reserve(
    userId: string,
    reservationId: string,
    amount: Chips,
    idempotencyKey: string,
    onReserved?: (trx: Transaction<Database>) => Promise<void>,
  ): Promise<OpResult> {
    return this.db.transaction().execute(async (trx) => {
      await this.lock(trx, userId);
      const replay = await this.findTxn(trx, idempotencyKey);
      if (replay) return { txnId: replay, replayed: true };

      const entries = L.reserve(userId, amount);
      await this.validate(trx, entries); // core.apply throws if chips would go negative
      const txnId = await this.write(trx, idempotencyKey, 'reserve', entries);
      await trx
        .insertInto('chip_reservation')
        .values({ reservation_id: reservationId, user_id: userId, amount, status: 'open' })
        .execute();
      if (onReserved) await onReserved(trx);
      return { txnId, replayed: false };
    });
  }

  /**
   * Settle a reservation, and — atomically in the same transaction — run `onSettled` (D44). Settlement
   * uses it to stamp the bet's status alongside the money move; on a replayed settle (a concurrent drain
   * won the race) the hook does NOT run, so a losing drain can never overwrite the bet's status.
   */
  async settle(
    reservationId: string,
    outcome: SettleOutcome,
    winnings: Chips,
    idempotencyKey: string,
    onSettled?: (trx: Transaction<Database>) => Promise<void>,
  ): Promise<OpResult> {
    return this.db.transaction().execute(async (trx) => {
      const resv = await trx
        .selectFrom('chip_reservation')
        .selectAll()
        .where('reservation_id', '=', reservationId)
        .forUpdate()
        .executeTakeFirst();
      if (!resv) throw new ReservationNotFoundError(reservationId);

      await this.lock(trx, resv.user_id);
      const replay = await this.findTxn(trx, idempotencyKey);
      if (replay) return { txnId: replay, replayed: true };
      if (resv.status !== 'open') throw new ReservationNotOpenError(reservationId);

      const stake = chips(resv.amount);
      const entries = L.settlementEntries(outcome, resv.user_id, stake, winnings);

      await this.validate(trx, entries);
      const txnId = await this.write(trx, idempotencyKey, `settle:${outcome}`, entries);
      await trx
        .updateTable('chip_reservation')
        .set({ status: outcome === 'void' ? 'released' : 'settled', closed_at: new Date() })
        .where('reservation_id', '=', reservationId)
        .execute();
      if (onSettled) await onSettled(trx);
      return { txnId, replayed: false };
    });
  }

  /**
   * Correct an already-settled bet (D35): one compensating transaction — reverse the old outcome,
   * apply the new. reverse(old) goes FIRST so the reserved account never underflows mid-fold; the
   * reserved legs cancel, so the reservation stays settled and the reserved balance is untouched.
   * A clawback beyond the player's balance (won→lost after spend) fails closed in validate().
   */
  async resettle(
    reservationId: string,
    oldOutcome: SettleOutcome,
    newOutcome: SettleOutcome,
    winnings: Chips,
    idempotencyKey: string,
    onResettled?: (trx: Transaction<Database>) => Promise<void>,
  ): Promise<OpResult> {
    return this.db.transaction().execute(async (trx) => {
      const resv = await trx
        .selectFrom('chip_reservation')
        .selectAll()
        .where('reservation_id', '=', reservationId)
        .forUpdate()
        .executeTakeFirst();
      if (!resv) throw new ReservationNotFoundError(reservationId);

      await this.lock(trx, resv.user_id);
      const replay = await this.findTxn(trx, idempotencyKey);
      if (replay) return { txnId: replay, replayed: true };
      if (resv.status === 'open') throw new ReservationNotSettledError(reservationId);

      const stake = chips(resv.amount);
      const entries = [
        ...L.reverseEntries(L.settlementEntries(oldOutcome, resv.user_id, stake, winnings)),
        ...L.settlementEntries(newOutcome, resv.user_id, stake, winnings),
      ];
      await this.validate(trx, entries);
      const txnId = await this.write(trx, idempotencyKey, `resettle:${oldOutcome}->${newOutcome}`, entries);
      if (newOutcome === 'void') {
        await trx
          .updateTable('chip_reservation')
          .set({ status: 'released' })
          .where('reservation_id', '=', reservationId)
          .execute();
      }
      if (onResettled) await onResettled(trx);
      return { txnId, replayed: false };
    });
  }

  async balance(userId: string): Promise<{ available: Chips; reserved: Chips }> {
    return {
      available: chips(await this.accountBalance(this.db, L.userChips(userId))),
      reserved: chips(await this.accountBalance(this.db, L.userReserved(userId))),
    };
  }

  /** The user's chip-movement history (newest first), bounded by `limit` (CLAUDE.md §3.3). */
  async statement(userId: string, limit: number): Promise<StatementRow[]> {
    const rows = await this.db
      .selectFrom('ledger_entry as e')
      .innerJoin('ledger_txn as t', 't.txn_id', 'e.txn_id')
      .select(['e.account', 'e.amount', 't.kind', 'e.created_at as at'])
      .where('e.account', 'in', [L.userChips(userId), L.userReserved(userId)])
      .orderBy('e.id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({ account: r.account, amount: chips(r.amount), kind: r.kind, at: r.at }));
  }

  /** A5.1 — the two invariants, checked against the live database. */
  async verifyIntegrity(): Promise<IntegrityReport> {
    const total = await sql<{ bal: string }>`
      SELECT COALESCE(SUM(amount), 0)::text AS bal FROM ledger_entry
    `.execute(this.db);
    const mismatch = await sql<{ n: string }>`
      SELECT COUNT(*)::text AS n FROM (
        SELECT le.user_id, le.reserved, COALESCE(cr.open_sum, 0) AS open_sum
        FROM (
          SELECT substring(account from 'user:(.*):reserved') AS user_id, SUM(amount) AS reserved
          FROM ledger_entry WHERE account LIKE 'user:%:reserved' GROUP BY 1
        ) le
        LEFT JOIN (
          SELECT user_id, SUM(amount) AS open_sum
          FROM chip_reservation WHERE status = 'open' GROUP BY 1
        ) cr ON cr.user_id = le.user_id
        WHERE le.reserved <> COALESCE(cr.open_sum, 0)
      ) m
    `.execute(this.db);
    return {
      sumsToZero: BigInt(total.rows[0]?.bal ?? '0') === 0n,
      reservedMatchesOpenReservations: BigInt(mismatch.rows[0]?.n ?? '0') === 0n,
    };
  }

  // ---- internals -----------------------------------------------------------

  private async commit(
    userId: string,
    idempotencyKey: string,
    kind: string,
    entriesFor: () => L.Entry[],
  ): Promise<OpResult> {
    return this.db.transaction().execute(async (trx) => {
      await this.lock(trx, userId);
      const replay = await this.findTxn(trx, idempotencyKey);
      if (replay) return { txnId: replay, replayed: true };
      const entries = entriesFor();
      await this.validate(trx, entries);
      const txnId = await this.write(trx, idempotencyKey, kind, entries);
      return { txnId, replayed: false };
    });
  }

  /** Serialise all of a user's chip operations so the balance check + insert is atomic. */
  private async lock(trx: Transaction<Database>, userId: string): Promise<void> {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`.execute(trx);
  }

  private async findTxn(trx: Transaction<Database>, key: string): Promise<string | null> {
    const row = await trx
      .selectFrom('ledger_txn')
      .select('txn_id')
      .where('idempotency_key', '=', key)
      .executeTakeFirst();
    return row?.txn_id ?? null;
  }

  /** Reuse the pure core's precondition rule against the live balances — single source of truth. */
  private async validate(trx: Transaction<Database>, entries: readonly L.Entry[]): Promise<void> {
    const accounts = [...new Set(entries.map((e) => e.account))];
    const current = new Map<L.AccountId, Chips>();
    for (const a of accounts) current.set(a, chips(await this.accountBalance(trx, a)));
    L.apply(current, entries);
  }

  private async write(
    trx: Transaction<Database>,
    idempotencyKey: string,
    kind: string,
    entries: readonly L.Entry[],
  ): Promise<string> {
    const txnId = randomUUID();
    await trx.insertInto('ledger_txn').values({ txn_id: txnId, idempotency_key: idempotencyKey, kind }).execute();
    await trx
      .insertInto('ledger_entry')
      .values(entries.map((e, seq) => ({ txn_id: txnId, seq, account: e.account, amount: e.amount })))
      .execute();
    return txnId;
  }

  private async accountBalance(
    db: Kysely<Database> | Transaction<Database>,
    account: string,
  ): Promise<bigint> {
    const r = await sql<{ bal: string }>`
      SELECT COALESCE(SUM(amount), 0)::text AS bal FROM ledger_entry WHERE account = ${account}
    `.execute(db);
    return BigInt(r.rows[0]?.bal ?? '0');
  }
}
