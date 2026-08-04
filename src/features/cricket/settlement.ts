import { BallEvent } from '../../integrations/feed';
import { BetSide } from '../../db';
import { runsInOvers } from './match-state';

/**
 * Fancy/session settlement — pure, replayable from stored ball events (D35). Innings-1 session
 * markets ("N over runs"); multi-innings is deferred. Settlement resolves against a bet's *struck*
 * line, never the market's repriced line.
 */

const INNINGS = 1;
const BALLS_PER_OVER = 6;
const ALL_OUT = 10;

const inningsBalls = (balls: readonly BallEvent[]): BallEvent[] => balls.filter((b) => b.innings === INNINGS);

/** Runs scored in the first `overs` overs of innings 1 — the window a session market covers. */
export function sessionRuns(balls: readonly BallEvent[], overs: number): number {
  return runsInOvers(inningsBalls(balls), overs).runs;
}

/** The window is settleable once its overs are bowled, or innings 1 ends early (all out / next innings). */
export function sessionComplete(balls: readonly BallEvent[], overs: number): boolean {
  const i1 = inningsBalls(balls);
  if (runsInOvers(i1, overs).legalBalls >= overs * BALLS_PER_OVER) return true;
  const inningsEnded = balls.some((b) => b.innings > INNINGS) || i1.filter((b) => b.isWicket).length >= ALL_OUT;
  return inningsEnded;
}

export type SessionOutcome = 'won' | 'lost';

/** Back wins iff runs reach the line; lay wins iff they fall short. The `≥` boundary favours back (D35). */
export function resolveFancyBet(side: BetSide, line: number, actualRuns: number): SessionOutcome {
  const lineReached = actualRuns >= line;
  const backWins = side === 'back' ? lineReached : !lineReached;
  return backWins ? 'won' : 'lost';
}

/** Runner markets (match-odds/bookmaker, D37): back wins iff it backed the winning runner; lay mirrors. */
export function resolveRunnerBet(side: BetSide, betRunnerId: string, winningRunnerId: string): SessionOutcome {
  const backedWinner = betRunnerId === winningRunnerId;
  const backWins = side === 'back' ? backedWinner : !backedWinner;
  return backWins ? 'won' : 'lost';
}
