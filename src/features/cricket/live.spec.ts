import { BallEvent } from '../../integrations/feed';
import { inningsOver, nextBall, outcomeFromRoll } from './live';

const ball = (seq: number, over: number, ballInOver: number, runs: number, extras = 0, wicket = false, legal = true): BallEvent => ({
  matchId: 'm',
  sequence: seq,
  innings: 1,
  over,
  ballInOver,
  runsOffBat: runs,
  extras,
  isWicket: wicket,
  isLegal: legal,
});

describe('live ball generation (pure, D43)', () => {
  it('maps rolls to weighted outcomes', () => {
    expect(outcomeFromRoll(0)).toMatchObject({ runsOffBat: 0, isLegal: true, isWicket: false });
    expect(outcomeFromRoll(0.5)).toMatchObject({ runsOffBat: 1 });
    expect(outcomeFromRoll(0.85)).toMatchObject({ runsOffBat: 4 });
    expect(outcomeFromRoll(0.92)).toMatchObject({ runsOffBat: 6 });
    expect(outcomeFromRoll(0.95)).toMatchObject({ isWicket: true, isLegal: true });
    expect(outcomeFromRoll(0.99)).toMatchObject({ extras: 1, isLegal: false });
  });

  it('positions the next ball from legal balls bowled', () => {
    expect(nextBall('m', [], 0)).toMatchObject({ sequence: 1, over: 0, ballInOver: 1 });
    const six = [0, 1, 2, 3, 4, 5].map((i) => ball(i + 1, 0, i + 1, 1));
    expect(nextBall('m', six, 0)).toMatchObject({ sequence: 7, over: 1, ballInOver: 1 });
  });

  it('an extra does not advance the legal-ball count (re-bowled)', () => {
    const withExtra = [ball(1, 0, 1, 0, 1, false, false)];
    expect(nextBall('m', withExtra, 0)).toMatchObject({ sequence: 2, over: 0, ballInOver: 1 });
  });

  it('innings ends at 10 wickets or 20 overs', () => {
    expect(inningsOver([])).toBe(false);
    expect(inningsOver(Array.from({ length: 10 }, (_, i) => ball(i + 1, 0, 1, 0, 0, true)))).toBe(true);
    expect(inningsOver(Array.from({ length: 120 }, (_, i) => ball(i + 1, Math.floor(i / 6), (i % 6) + 1, 1)))).toBe(true);
  });
});
