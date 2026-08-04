/**
 * The cricket ball-by-ball feed — the settlement source of truth (CRICKET-MVP §2.4).
 * One interface, many sources (Liskov): `FixtureFeed` for dev/CI, a live adapter later. Under D32
 * no accountability bar applies, so any real source is fine in prod; fixtures are dev-only.
 */
export type MatchStatus = 'scheduled' | 'inplay' | 'suspended' | 'closed';

export interface MatchFixture {
  matchId: string;
  competition: string;
  name: string;
  startsAt: Date;
}

/** One delivery. Modelled on standard cricket scoring; `sequence` is the global order per match. */
export interface BallEvent {
  matchId: string;
  sequence: number;
  innings: number;
  over: number;
  ballInOver: number;
  runsOffBat: number;
  extras: number;
  isWicket: boolean;
  isLegal: boolean;
}

/** Thrown by a feed when it goes down mid-stream → the match is suspended, never fabricated. */
export class FeedUnavailableError extends Error {}

export interface CricketFeed {
  readonly source: string;
  fixtures(): Promise<MatchFixture[]>;
  /** Ball events for a match, in sequence order. May throw FeedUnavailableError mid-stream. */
  ballEvents(matchId: string): AsyncIterable<BallEvent>;
  health(): Promise<boolean>;
}
