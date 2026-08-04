/** Typed trading-console failures (CLAUDE.md §3.9). */
export class SoDViolationError extends Error {} // approver == proposer (D36)
export class ActionNotFoundError extends Error {}
export class ActionNotPendingError extends Error {} // already executed/rejected, or lost the approve race
