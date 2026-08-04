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
