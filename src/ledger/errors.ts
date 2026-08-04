/** Typed ledger failures (CLAUDE.md §3.9). Balance/insufficient failures reuse core.LedgerError. */
export class ReservationNotFoundError extends Error {}
export class ReservationNotOpenError extends Error {}
/** Resettlement was asked of a reservation that was never settled (D35). */
export class ReservationNotSettledError extends Error {}
