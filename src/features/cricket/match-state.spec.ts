import * as fc from 'fast-check';
import { BallEvent } from '../../integrations/feed';
import { ballOutcome, deriveScore, scorecard } from './match-state';

function ball(sequence: number, runsOffBat: number, extras = 0, isWicket = false, innings = 1): BallEvent {
  return {
    matchId: 'm',
    sequence,
    innings,
    over: Math.floor((sequence - 1) / 6),
    ballInOver: ((sequence - 1) % 6) + 1,
    runsOffBat,
    extras,
    isWicket,
    isLegal: extras === 0,
  };
}

describe('deriveScore (CM1, pure)', () => {
  it('sums runs, counts wickets and legal balls', () => {
    const s = deriveScore([ball(1, 4), ball(2, 0, 1), ball(3, 0, 0, true), ball(4, 6)]);
    expect(s.runs).toBe(11); // 4 + 1 + 0 + 6
    expect(s.wickets).toBe(1);
    expect(s.legalBalls).toBe(3); // ball 2 was an extra
  });

  it('is order-independent — replaying a reordered set gives the same score', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            r: fc.integer({ min: 0, max: 6 }),
            e: fc.integer({ min: 0, max: 5 }),
            w: fc.boolean(),
          }),
          { minLength: 1, maxLength: 80 },
        ),
        (raw) => {
          const inOrder = raw.map((x, i) => ball(i + 1, x.r, x.e, x.w));
          const reordered = [...inOrder].reverse();
          expect(deriveScore(reordered)).toEqual(deriveScore(inOrder));
        },
      ),
    );
  });
});

describe('scorecard (in-play strip, pure)', () => {
  it('totals each innings and isolates the current over', () => {
    // sequence is globally unique per match; innings 2 continues the sequence and resets the over.
    const balls = [
      ball(1, 4), ball(2, 1), ball(3, 0, 0, true), ball(4, 2), ball(5, 0), ball(6, 1), // innings 1, over 0
      ball(7, 6), // innings 1, over 1
      { ...ball(8, 3), innings: 2, over: 0 },
      { ...ball(9, 0, 0, true), innings: 2, over: 0 },
      { ...ball(10, 4), innings: 2, over: 0 },
    ];
    const sc = scorecard(balls);
    expect(sc.innings).toEqual([
      { innings: 1, runs: 14, wickets: 1, legalBalls: 7 },
      { innings: 2, runs: 7, wickets: 1, legalBalls: 3 },
    ]);
    // current over = the latest innings' latest over (innings 2, over 0) — 3 balls
    expect(sc.currentOver.map((b) => b.runsOffBat)).toEqual([3, 0, 4]);
  });

  it('is empty before a ball is bowled', () => {
    expect(scorecard([])).toEqual({ innings: [], currentOver: [] });
  });
});

describe('ballOutcome (ball-by-ball, pure)', () => {
  it('maps a delivery to its outcome name', () => {
    expect(ballOutcome(ball(1, 0))).toBe('0 Runs');
    expect(ballOutcome(ball(1, 1))).toBe('1 Run');
    expect(ballOutcome(ball(1, 4))).toBe('4 Runs');
    expect(ballOutcome(ball(1, 6))).toBe('6 Runs');
    expect(ballOutcome(ball(1, 0, 0, true))).toBe('Wicket');
    expect(ballOutcome(ball(1, 0, 2))).toBe('Extra Runs');
  });
});
