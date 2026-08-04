import { BallEvent } from '../../integrations/feed';
import { priceSessionRuns } from './pricing';

const ball = (sequence: number, over: number, runs: number): BallEvent => ({
  matchId: 'm',
  sequence,
  innings: 1,
  over,
  ballInOver: 1,
  runsOffBat: runs,
  extras: 0,
  isWicket: false,
  isLegal: true,
});

describe('priceSessionRuns (CM2, pure placeholder)', () => {
  it('reprices as balls arrive — a boundary raises the line', () => {
    const before = priceSessionRuns(6, []);
    const after = priceSessionRuns(6, [ball(1, 0, 6)]);
    expect(after.lineValue).toBeGreaterThan(before.lineValue);
  });

  it('only counts runs inside the session window', () => {
    const inWindow = priceSessionRuns(6, [ball(1, 5, 10)]); // over 5 < 6
    const outWindow = priceSessionRuns(6, [ball(1, 7, 10)]); // over 7 — outside the first 6
    expect(inWindow.lineValue).toBeGreaterThan(outWindow.lineValue);
  });

  it('quotes scaled-integer prices > 1.0 (no ladder)', () => {
    const q = priceSessionRuns(6, []);
    expect(q.backPrice as bigint).toBe(19500n);
    expect(q.layPrice as bigint).toBe(20500n);
  });
});
