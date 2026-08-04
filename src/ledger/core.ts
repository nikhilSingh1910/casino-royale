import { add, Chips, ZERO } from '../shared/money';

/**
 * The pure double-entry core — the ONE decider of what entries an operation produces and what
 * preconditions hold (CLAUDE.md §4, §5). The Postgres repo persists these; it never re-derives
 * the rules. No I/O, no floats — fully property-testable (CLAUDE.md §3.12).
 */
export type AccountId = string;

/** mint: source of granted chips. house: the book's counterparty. Both may go negative. */
export const MINT: AccountId = 'mint';
export const HOUSE: AccountId = 'house';
export const userChips = (userId: string): AccountId => `user:${userId}:chips`;
export const userReserved = (userId: string): AccountId => `user:${userId}:reserved`;

export interface Entry {
  readonly account: AccountId;
  readonly amount: Chips;
}
export type Balances = ReadonlyMap<AccountId, Chips>;

export class LedgerError extends Error {}

const neg = (a: Chips): Chips => -(a as bigint) as Chips;
const bal = (b: Balances, a: AccountId): Chips => b.get(a) ?? ZERO;

/** Player-facing accounts must never go negative. System accounts (mint/house) may. */
const mustStayNonNegative = (account: AccountId): boolean => account.startsWith('user:');

function requirePositive(a: Chips): void {
  if ((a as bigint) <= 0n) throw new LedgerError(`Amount must be positive, got ${a}`);
}
function requireNonNegative(a: Chips): void {
  if ((a as bigint) < 0n) throw new LedgerError(`Amount must be non-negative, got ${a}`);
}

/** Apply a balanced entry set. Throws on imbalance or on a player balance going negative. */
export function apply(balances: Balances, entries: readonly Entry[]): Balances {
  let sum = 0n;
  for (const e of entries) sum += e.amount as bigint;
  if (sum !== 0n) throw new LedgerError(`Unbalanced transaction: entries sum to ${sum}, not 0`);

  const next = new Map<AccountId, Chips>(balances);
  for (const e of entries) {
    const updated = add(bal(next, e.account), e.amount);
    if (mustStayNonNegative(e.account) && (updated as bigint) < 0n) {
      throw new LedgerError(`Insufficient funds: ${e.account} would go to ${updated}`);
    }
    next.set(e.account, updated);
  }
  return next;
}

/** Grant chips (free / daily bonus): mint → user. */
export const topUp = (userId: string, amount: Chips): Entry[] => {
  requirePositive(amount);
  return [
    { account: MINT, amount: neg(amount) },
    { account: userChips(userId), amount },
  ];
};

/** Place a bet: move the stake (or lay liability) chips → reserved. */
export const reserve = (userId: string, amount: Chips): Entry[] => {
  requirePositive(amount);
  return [
    { account: userChips(userId), amount: neg(amount) },
    { account: userReserved(userId), amount },
  ];
};

/** Bet won: return the reserved stake, and pay winnings from the house. */
export const payout = (userId: string, stake: Chips, win: Chips): Entry[] => {
  requirePositive(stake);
  requireNonNegative(win);
  return [
    { account: userReserved(userId), amount: neg(stake) },
    { account: userChips(userId), amount: stake },
    { account: HOUSE, amount: neg(win) },
    { account: userChips(userId), amount: win },
  ];
};

/** Bet lost: the reserved stake goes to the house. */
export const capture = (userId: string, stake: Chips): Entry[] => {
  requirePositive(stake);
  return [
    { account: userReserved(userId), amount: neg(stake) },
    { account: HOUSE, amount: stake },
  ];
};

/** Bet void / cancelled: return the reserved stake to available chips. */
export const release = (userId: string, stake: Chips): Entry[] => {
  requirePositive(stake);
  return [
    { account: userReserved(userId), amount: neg(stake) },
    { account: userChips(userId), amount: stake },
  ];
};

export type SettleOutcome = 'won' | 'lost' | 'void';

/** The one mapping outcome→entries — shared by settle and resettle so there is a single formula (§3.2, D35). */
export const settlementEntries = (
  outcome: SettleOutcome,
  userId: string,
  stake: Chips,
  win: Chips,
): Entry[] =>
  outcome === 'won' ? payout(userId, stake, win) : outcome === 'lost' ? capture(userId, stake) : release(userId, stake);

/** Negate an entry set — the compensating half of a resettlement (D35). Sum stays zero. */
export const reverseEntries = (entries: readonly Entry[]): Entry[] =>
  entries.map((e) => ({ account: e.account, amount: neg(e.amount) }));

/** The whole ledger must always sum to zero (money is neither created nor destroyed). */
export function sumAll(b: Balances): bigint {
  let s = 0n;
  for (const v of b.values()) s += v as bigint;
  return s;
}
