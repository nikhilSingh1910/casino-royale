import { BallEvent } from '../../integrations/feed';

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

/** The next ball's position (innings 1) from the balls so far, plus its rolled outcome. Pure. */
export function nextBall(matchId: string, balls: readonly BallEvent[], r: number): NewBall {
  const i1 = balls.filter((b) => b.innings === 1);
  const legal = i1.filter((b) => b.isLegal).length;
  const sequence = balls.reduce((m, b) => Math.max(m, b.sequence), 0) + 1;
  return { matchId, sequence, innings: 1, over: Math.floor(legal / 6), ballInOver: (legal % 6) + 1, ...outcomeFromRoll(r) };
}

/** The demo innings ends at 10 wickets or 20 overs. */
export function inningsOver(balls: readonly BallEvent[]): boolean {
  const i1 = balls.filter((b) => b.innings === 1);
  return i1.filter((b) => b.isWicket).length >= 10 || i1.filter((b) => b.isLegal).length >= 120;
}
