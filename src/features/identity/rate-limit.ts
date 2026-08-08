/**
 * A per-process fixed-window rate limiter — a basic abuse guard for anonymous, resource-creating
 * endpoints (audit O3). Pure of wall-clock: the caller passes `now`, so it is deterministically
 * testable. A real deployment fronts this with a distributed limiter / API gateway.
 */
export class FixedWindowLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record a hit at `now` (ms). Returns false once the window's limit is reached. */
  tryAcquire(now: number): boolean {
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count >= this.limit) return false;
    this.count += 1;
    return true;
  }
}
