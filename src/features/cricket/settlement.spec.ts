import { BallEvent } from '../../integrations/feed';
import { resolveFancyBet, resolveRunnerBet, sessionComplete, sessionRuns } from './settlement';

let seq = 0;
const ball = (over: number, runs: number, o: Partial<BallEvent> = {}): BallEvent => ({
  matchId: 'm',
  sequence: (seq += 1),
  innings: 1,
  over,
  ballInOver: 1,
  runsOffBat: runs,
  extras: 0,
  isWicket: false,
  isLegal: true,
  ...o,
});
// A full over of `n` legal balls in the given over, r runs each.
const over = (o: number, n = 6, r = 1): BallEvent[] => Array.from({ length: n }, () => ball(o, r));

describe('fancy settlement resolver (pure, D35)', () => {
  beforeEach(() => {
    seq = 0;
  });

  describe('resolveFancyBet — back wins iff runs ≥ line', () => {
    it('back wins over the line, loses under, and wins exactly on it', () => {
      expect(resolveFancyBet('back', 40, 45)).toBe('won');
      expect(resolveFancyBet('back', 40, 30)).toBe('lost');
      expect(resolveFancyBet('back', 40, 40)).toBe('won'); // ≥ boundary favours back
    });
    it('lay is the mirror — wins under the line, loses on/over it', () => {
      expect(resolveFancyBet('lay', 40, 30)).toBe('won');
      expect(resolveFancyBet('lay', 40, 45)).toBe('lost');
      expect(resolveFancyBet('lay', 40, 40)).toBe('lost');
    });
  });

  describe('resolveRunnerBet — back the winning runner (D37)', () => {
    it('back wins on the winner, loses on any other runner', () => {
      expect(resolveRunnerBet('back', 'A', 'A')).toBe('won');
      expect(resolveRunnerBet('back', 'B', 'A')).toBe('lost');
    });
    it('lay is the mirror', () => {
      expect(resolveRunnerBet('lay', 'A', 'A')).toBe('lost');
      expect(resolveRunnerBet('lay', 'B', 'A')).toBe('won');
    });
  });

  describe('sessionRuns — innings-1 runs inside the window only', () => {
    it('sums runs+extras under the over window, ignoring later overs', () => {
      const balls = [...over(0, 6, 2), ...over(5, 6, 3), ...over(6, 6, 9)]; // over 6 is outside a 6-over window
      expect(sessionRuns(balls, 6)).toBe(6 * 2 + 6 * 3);
    });
    it('ignores innings-2 balls', () => {
      const balls = [...over(0, 6, 2), ...over(0, 6, 5).map((b) => ({ ...b, innings: 2 }))];
      expect(sessionRuns(balls, 6)).toBe(12); // only innings 1
    });
    it('counts extras toward the session', () => {
      const balls = [ball(0, 0, { extras: 4, isLegal: false }), ...over(0, 5, 1)];
      expect(sessionRuns(balls, 6)).toBe(4 + 5);
    });
  });

  describe('sessionComplete — window filled or innings ended', () => {
    it('is false before the over-block is bowled', () => {
      expect(sessionComplete(over(0, 6, 1), 6)).toBe(false); // only 6 of 36 legal balls
    });
    it('is true once the window has its legal balls (wides do not count)', () => {
      const six = [0, 1, 2, 3, 4, 5].flatMap((o) => over(o, 6, 1));
      expect(sessionComplete(six, 6)).toBe(true);
    });
    it('is true when innings 1 ends early (all out)', () => {
      const balls = [...over(0, 5, 1), ...Array.from({ length: 10 }, () => ball(1, 0, { isWicket: true }))];
      expect(sessionComplete(balls, 6)).toBe(true);
    });
    it('is true when innings 2 has started', () => {
      const balls = [...over(0, 3, 1), ball(0, 1, { innings: 2 })];
      expect(sessionComplete(balls, 6)).toBe(true);
    });
  });
});
