import { BallEvent } from '../../integrations/feed';
import { InningsScore, scorecard } from './match-state';

/** A generated demo delivery. The feed *proposes* raw balls; the platform prices & settles them. */
export interface NewBall {
  matchId: string;
  sequence: number;
  innings: number;
  over: number;
  ballInOver: number;
  runsOffBat: number;
  extras: number;
  isWicket: boolean;
  isLegal: boolean;
}

type Outcome = Pick<NewBall, 'runsOffBat' | 'extras' | 'isWicket' | 'isLegal'>;

const BALLS_PER_OVER = 6;
const MAX_LEGAL = 120; // a 20-over innings
const ALL_OUT = 10;

/** Map a uniform roll [0,1) to a weighted ball outcome — pure; the ticker supplies the randomness. */
export function outcomeFromRoll(r: number): Outcome {
  if (r < 0.34) return { runsOffBat: 0, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.64) return { runsOffBat: 1, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.76) return { runsOffBat: 2, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.8) return { runsOffBat: 3, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.9) return { runsOffBat: 4, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.93) return { runsOffBat: 6, extras: 0, isWicket: false, isLegal: true };
  if (r < 0.97) return { runsOffBat: 0, extras: 0, isWicket: true, isLegal: true };
  return { runsOffBat: 0, extras: 1, isWicket: false, isLegal: false }; // wide/no-ball (re-bowled)
}

const inningsOf = (balls: readonly BallEvent[], innings: number): InningsScore =>
  scorecard(balls).innings.find((s) => s.innings === innings) ?? { innings, runs: 0, wickets: 0, legalBalls: 0 };

/** An innings ends at 10 wickets, 20 overs, or — when chasing — once the target is reached. */
const inningsClosed = (s: InningsScore, target: number | null): boolean =>
  s.wickets >= ALL_OUT || s.legalBalls >= MAX_LEGAL || (target !== null && s.runs >= target);

/** The innings currently being bowled: 1, 2, or 0 when the match is complete (D46). */
export function currentInnings(balls: readonly BallEvent[]): 0 | 1 | 2 {
  const i1 = inningsOf(balls, 1);
  if (!inningsClosed(i1, null)) return 1;
  if (!inningsClosed(inningsOf(balls, 2), i1.runs + 1)) return 2;
  return 0;
}

export function matchComplete(balls: readonly BallEvent[]): boolean {
  return currentInnings(balls) === 0;
}

/** The next ball's position in the live innings + its rolled outcome. Pure; call only when not complete. */
export function nextBall(matchId: string, balls: readonly BallEvent[], r: number): NewBall {
  const innings = currentInnings(balls) || 2; // the ticker guards on matchComplete; 2 is a safe fallback
  const legal = balls.filter((b) => b.innings === innings && b.isLegal).length;
  const sequence = balls.reduce((m, b) => Math.max(m, b.sequence), 0) + 1;
  return { matchId, sequence, innings, over: Math.floor(legal / BALLS_PER_OVER), ballInOver: (legal % BALLS_PER_OVER) + 1, ...outcomeFromRoll(r) };
}

/** The winner: the side batting 2nd if it passed the 1st-innings total, else the side that batted first (ties → first). */
export function deriveWinner(balls: readonly BallEvent[], teamFirst: string, teamSecond: string): string {
  return inningsOf(balls, 2).runs >= inningsOf(balls, 1).runs + 1 ? teamSecond : teamFirst;
}
