import * as fc from 'fast-check';
import { BallEvent } from '../../integrations/feed';
import { deriveScore } from './match-state';

function ball(sequence: number, runsOffBat: number, extras = 0, isWicket = false): BallEvent {
  return {
    matchId: 'm',
    sequence,
    innings: 1,
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
