import { betPnl } from './bet-history.service';

describe('betPnl (pure, PC1) — derived from the settled outcome, never stored', () => {
  it('a won bet returns the winnings; a lost bet returns minus its reserved; a void is zero', () => {
    expect(betPnl('won', 100n, 90n)).toBe(90n);
    expect(betPnl('lost', 100n, 90n)).toBe(-100n);
    expect(betPnl('void', 100n, 90n)).toBe(0n);
  });

  it('an open bet is pending (null), not a fabricated number', () => {
    expect(betPnl('open', 100n, 90n)).toBeNull();
  });
});
