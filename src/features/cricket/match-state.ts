import { BallEvent } from '../../integrations/feed';

export interface MatchScore {
  innings: number;
  runs: number;
  wickets: number;
  legalBalls: number;
}

/**
 * Derive the score by replaying ball events **in sequence order** — the raw store is the source of
 * truth (CRICKET-MVP §2.4). Pure, so out-of-order or duplicated arrival can't corrupt state: state
 * is a fold over the ordered set, not a running mutation.
 */
export function deriveScore(balls: readonly BallEvent[]): MatchScore {
  const ordered = [...balls].sort((a, b) => a.sequence - b.sequence);
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let innings = 0;
  for (const b of ordered) {
    runs += b.runsOffBat + b.extras;
    if (b.isWicket) wickets += 1;
    if (b.isLegal) legalBalls += 1;
    if (b.innings > innings) innings = b.innings;
  }
  return { innings, runs, wickets, legalBalls };
}

export interface InningsScore {
  innings: number;
  runs: number;
  wickets: number;
  legalBalls: number;
}
export interface Scorecard {
  innings: InningsScore[];
  currentOver: BallEvent[];
}

/** Per-innings totals + the balls of the current over — the in-play score strip, folded from the raw store. */
export function scorecard(balls: readonly BallEvent[]): Scorecard {
  const ordered = [...balls].sort((a, b) => a.sequence - b.sequence);
  const byInnings = new Map<number, InningsScore>();
  for (const b of ordered) {
    const s = byInnings.get(b.innings) ?? { innings: b.innings, runs: 0, wickets: 0, legalBalls: 0 };
    s.runs += b.runsOffBat + b.extras;
    if (b.isWicket) s.wickets += 1;
    if (b.isLegal) s.legalBalls += 1;
    byInnings.set(b.innings, s);
  }
  const innings = [...byInnings.values()].sort((a, b) => a.innings - b.innings);

  let currentOver: BallEvent[] = [];
  const last = ordered[ordered.length - 1];
  if (last) {
    const inn = ordered.filter((b) => b.innings === last.innings);
    const maxOver = inn.reduce((m, b) => (b.over > m ? b.over : m), 0);
    currentOver = inn.filter((b) => b.over === maxOver);
  }
  return { innings, currentOver };
}

/** The ball-by-ball outcome a delivery produced (matches the ball_by_ball runner names). Pure. */
export function ballOutcome(b: BallEvent): string {
  if (b.isWicket) return 'Wicket';
  if (b.extras > 0) return 'Extra Runs';
  return b.runsOffBat === 1 ? '1 Run' : `${b.runsOffBat} Runs`;
}

/** Runs and legal balls within the first `overs` overs — the window a session market covers. */
export function runsInOvers(balls: readonly BallEvent[], overs: number): { runs: number; legalBalls: number } {
  let runs = 0;
  let legalBalls = 0;
  for (const b of balls) {
    if (b.over < overs) {
      runs += b.runsOffBat + b.extras;
      if (b.isLegal) legalBalls += 1;
    }
  }
  return { runs, legalBalls };
}
