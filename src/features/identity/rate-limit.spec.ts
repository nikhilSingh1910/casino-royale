import { FixedWindowLimiter } from './rate-limit';

describe('FixedWindowLimiter (audit O3)', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const l = new FixedWindowLimiter(3, 1000);
    expect(l.tryAcquire(0)).toBe(true);
    expect(l.tryAcquire(100)).toBe(true);
    expect(l.tryAcquire(200)).toBe(true);
    expect(l.tryAcquire(300)).toBe(false); // 4th hit in the same window
  });

  it('resets when the window rolls over', () => {
    const l = new FixedWindowLimiter(2, 1000);
    expect(l.tryAcquire(0)).toBe(true);
    expect(l.tryAcquire(500)).toBe(true);
    expect(l.tryAcquire(600)).toBe(false);
    expect(l.tryAcquire(1000)).toBe(true); // a fresh window admits again
  });
});
