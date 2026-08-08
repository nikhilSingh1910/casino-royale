import { BallEvent } from '../../integrations/feed';
import { currentInnings, deriveWinner, matchComplete, nextBall, outcomeFromRoll } from './live';

const ball = (seq: number, innings: number, over: number, ballInOver: number, runs: number, extras = 0, wicket = false, legal = true): BallEvent => ({
  matchId: 'm',
  sequence: seq,
  innings,
  over,
  ballInOver,
  runsOffBat: runs,
  extras,
  isWicket: wicket,
  isLegal: legal,
});
const wickets = (startSeq: number, innings: number, n: number): BallEvent[] =>
  Array.from({ length: n }, (_, i) => ball(startSeq + i, innings, 0, 1, 0, 0, true, true));

describe('full-match live generation (pure, D46)', () => {
  it('maps rolls to weighted outcomes', () => {
    expect(outcomeFromRoll(0)).toMatchObject({ runsOffBat: 0, isLegal: true, isWicket: false });
    expect(outcomeFromRoll(0.85)).toMatchObject({ runsOffBat: 4 });
    expect(outcomeFromRoll(0.95)).toMatchObject({ isWicket: true, isLegal: true });
    expect(outcomeFromRoll(0.99)).toMatchObject({ extras: 1, isLegal: false });
  });

  it('positions the next ball within the innings currently being bowled', () => {
    expect(nextBall('m', [], 0)).toMatchObject({ innings: 1, sequence: 1, over: 0, ballInOver: 1 });
    const six = [0, 1, 2, 3, 4, 5].map((i) => ball(i + 1, 1, 0, i + 1, 1));
    expect(nextBall('m', six, 0)).toMatchObject({ innings: 1, sequence: 7, over: 1, ballInOver: 1 });
  });

  it('rolls into innings 2 once innings 1 closes (10 wickets)', () => {
    const i1closed = [ball(1, 1, 0, 1, 10), ...wickets(2, 1, 10)];
    expect(currentInnings([])).toBe(1);
    expect(currentInnings(i1closed)).toBe(2);
    expect(nextBall('m', i1closed, 0)).toMatchObject({ innings: 2, sequence: 12, over: 0, ballInOver: 1 });
  });

  it('completes the match and gives the defending side the win when the chase falls short', () => {
    const balls = [ball(1, 1, 0, 1, 30), ...wickets(2, 1, 10), ball(12, 2, 0, 1, 20), ...wickets(13, 2, 10)];
    expect(matchComplete(balls)).toBe(true);
    expect(deriveWinner(balls, 'A', 'B')).toBe('A'); // 20 < 31 target
  });

  it('completes the match and gives the chasing side the win when it passes the target', () => {
    const balls = [ball(1, 1, 0, 1, 30), ...wickets(2, 1, 10), ball(12, 2, 0, 1, 31)];
    expect(matchComplete(balls)).toBe(true); // innings 2 closed by reaching the target
    expect(deriveWinner(balls, 'A', 'B')).toBe('B'); // 31 >= 31
  });
});
