import { chips, Chips } from '../../shared/money';
import { BetSide } from '../../db';

/** The outcome a fancy/session bet is about (the line being reached), and its two possible resolutions. */
export const SESSION_OUTCOME = 'session:line';
const SESSION_MISS = 'session:miss';
export const SESSION_SCENARIOS: readonly string[] = [SESSION_OUTCOME, SESSION_MISS];

/** A bet's risk shape. `outcome` is what it's about — a runner id, or SESSION_OUTCOME for a fancy line. */
export interface BetPosition {
  outcome: string;
  side: BetSide;
  reserved: Chips;
  potentialPayout: Chips;
}

/** Whether a bet wins if `scenario` is the market's resolution: a back wins on its outcome, a lay on any other. */
const betWins = (b: BetPosition, scenario: string): boolean => (b.side === 'back' ? b.outcome === scenario : b.outcome !== scenario);

/** The worst value across a market's resolutions (each runner, or line reached / missed), floored at 0. */
function worstCase(bets: readonly BetPosition[], scenarios: readonly string[], valueOf: (b: BetPosition, wins: boolean) => bigint): bigint {
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
 * implementation for the bet slip and the risk console, correct for N-runner markets, not just binary.
 */
export function calculateCustomerExposure(bets: readonly BetPosition[], scenarios: readonly string[]): Chips {
  return chips(worstCase(bets, scenarios, (b, wins) => (wins ? -(b.potentialPayout as bigint) : (b.reserved as bigint))));
}

/**
 * CLAUDE.md §5 rule 11 — the *book's* worst-case payout on a market: the resolution whose winning bets
 * owe the most. Distinct from customer exposure (opposite side of the same positions, audit C2).
 */
export function calculateOperatorLiability(bets: readonly BetPosition[], scenarios: readonly string[]): Chips {
  return chips(worstCase(bets, scenarios, (b, wins) => (wins ? (b.potentialPayout as bigint) : 0n)));
}
