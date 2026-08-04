import { BallEvent, CricketFeed, FeedUnavailableError, MatchFixture } from './feed';

/** A recorded match: its fixture + ball sequence. `failAfter` simulates a feed outage. */
export interface MatchScript {
  fixture: MatchFixture;
  balls: readonly BallEvent[];
  failAfter?: number;
}

/** Deterministic, replayable feed for dev/CI (XC1.9). Never used in production (config tripwire). */
export class FixtureFeed implements CricketFeed {
  readonly source = 'fixture';

  constructor(private readonly scripts: readonly MatchScript[]) {}

  // eslint-disable-next-line local-rules/bounded-list-return -- a feed lists its handful of fixtures
  async fixtures(): Promise<MatchFixture[]> {
    return this.scripts.map((s) => s.fixture);
  }

  async *ballEvents(matchId: string): AsyncIterable<BallEvent> {
    const script = this.scripts.find((s) => s.fixture.matchId === matchId);
    if (!script) return;
    let emitted = 0;
    for (const ball of script.balls) {
      if (script.failAfter !== undefined && emitted >= script.failAfter) {
        throw new FeedUnavailableError(`feed down after ${emitted} events`);
      }
      emitted += 1;
      yield ball;
    }
  }

  async health(): Promise<boolean> {
    return true;
  }
}
