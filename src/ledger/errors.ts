/** Typed ledger failures (CLAUDE.md §3.9). Balance/insufficient failures reuse core.LedgerError. */
export class ReservationNotFoundError extends Error {}
export class ReservationNotOpenError extends Error {}
