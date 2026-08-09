import { chips, Chips } from '../../shared/money';
import { BetSide } from '../../db';
import { resolveFancyBet } from './settlement';

/** The marker outcome a fancy/session bet carries; its real resolution is per struck line, not one collapsed outcome (H2). */
export const SESSION_OUTCOME = 'session:line';

/** A market resolution to evaluate worst-case against: a runner winning, or the session ending on a given runs total. */
export type Resolution = { runner: string } | { runs: number };

/** A bet's risk shape. `outcome` is a runner id (runner markets); `line` is the struck line (fancy markets). */
export interface BetPosition {
  outcome: string;
  side: BetSide;
  reserved: Chips;
  potentialPayout: Chips;
  line?: number;
}

/** Whether a bet wins under a resolution: a runner bet on outcome-equality, a fancy bet on its own struck line vs the runs. */
const betWins = (b: BetPosition, r: Resolution): boolean =>
  'runs' in r ? resolveFancyBet(b.side, b.line ?? 0, r.runs) === 'won' : b.side === 'back' ? b.outcome === r.runner : b.outcome !== r.runner;

/** The worst value across a market's resolutions (each runner, or each struck-line interval), floored at 0. */
function worstCase(bets: readonly BetPosition[], scenarios: readonly Resolution[], valueOf: (b: BetPosition, wins: boolean) => bigint): bigint {
  let worst = 0n;
  for (const s of scenarios) {
    let v = 0n;
    for (const b of bets) v += valueOf(b, betWins(b, s));
    if (v > worst) worst = v;
  }
  return worst;
}

/**
 * CLAUDE.md §5 rule 2 — a *user's* worst-case loss on a market, across every resolution (audit C2): each
 * loser costs its reserved, each winner offsets by its winnings, and the worst resolution wins. One
 * implementation for the bet slip and the risk console, correct for N-runner and heterogeneous-line markets.
 */
export function calculateCustomerExposure(bets: readonly BetPosition[], scenarios: readonly Resolution[]): Chips {
  return chips(worstCase(bets, scenarios, (b, wins) => (wins ? -(b.potentialPayout as bigint) : (b.reserved as bigint))));
}

/**
 * CLAUDE.md §5 rule 11 — the *book's* worst-case payout on a market: the resolution whose winning bets
 * owe the most. Distinct from customer exposure (opposite side of the same positions, audit C2).
 */
export function calculateOperatorLiability(bets: readonly BetPosition[], scenarios: readonly Resolution[]): Chips {
  return chips(worstCase(bets, scenarios, (b, wins) => (wins ? (b.potentialPayout as bigint) : 0n)));
}

/**
 * The fancy resolutions to evaluate: the session ending below every struck line (runs 0) and exactly at each
 * distinct struck line. Complete because a fancy bet's win/lose flips only at its own line, so these points hit
 * every interval of constant outcome (H2 — replaces the old collapsed binary scenario set, which could not
 * represent a low-line back and a high-line lay both winning between the two lines).
 */
export function sessionResolutions(bets: readonly BetPosition[]): Resolution[] {
  const lines = new Set<number>([0]);
  for (const b of bets) if (b.line !== undefined) lines.add(b.line);
  return [...lines].map((runs) => ({ runs }));
}
