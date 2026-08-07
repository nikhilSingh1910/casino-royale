import { BallEvent } from '../../integrations/feed';
import { price, Price } from '../../shared/odds';
import { runsInOvers } from './match-state';

/**
 * PLACEHOLDER pricing. A real cricket model is licensed, not built from scratch (PRD §9.2, C-c).
 * This is intentionally naive and deterministic so the *reprice-per-ball mechanic* is testable —
 * the projection quality is not what CM2 proves. Integer math only.
 */
const EXPECTED_RUNS_PER_100_BALLS = 130n;
const BACK_PRICE: Price = price(19500); // ~1.95
const LAY_PRICE: Price = price(20500); // ~2.05

export interface FancyQuote {
  lineValue: number;
  backPrice: Price;
  layPrice: Price;
}

/** Session "N over runs" line = runs so far in the window + a naive projection of the remainder. */
export function priceSessionRuns(overs: number, balls: readonly BallEvent[]): FancyQuote {
  const windowBalls = overs * 6;
  const { runs, legalBalls } = runsInOvers(balls, overs);
  const remaining = Math.max(0, windowBalls - legalBalls);
  const projected = runs + Number((BigInt(remaining) * EXPECTED_RUNS_PER_100_BALLS) / 100n);
  return { lineValue: projected, backPrice: BACK_PRICE, layPrice: LAY_PRICE };
}

export interface BallOutcomeQuote {
  name: string;
  price: Price;
}
// PLACEHOLDER next-ball prices — a fixed reference set, not a real model (C-c). Back-only, integer scaled.
const BALL_BOOK: [string, number][] = [
  ['0 Runs', 21800],
  ['1 Run', 26200],
  ['2 Runs', 79200],
  ['3 Runs', 110000],
  ['4 Runs', 65200],
  ['6 Runs', 122000],
  ['Wicket', 68700],
  ['Extra Runs', 86700],
];
export const BALL_OUTCOMES: readonly string[] = BALL_BOOK.map(([name]) => name);
export function priceBallByBall(): BallOutcomeQuote[] {
  return BALL_BOOK.map(([name, p]) => ({ name, price: price(p) }));
}
