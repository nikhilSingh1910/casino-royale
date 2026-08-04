import { Injectable } from '@nestjs/common';
import { CricketFeed, FeedUnavailableError } from '../../integrations/feed';
import { CricketRepo } from './cricket.repo';

export interface IngestResult {
  ingested: number;
  suspended: boolean;
}

@Injectable()
export class FeedIngestService {
  constructor(private readonly repo: CricketRepo) {}

  async loadFixtures(feed: CricketFeed): Promise<number> {
    const fixtures = await feed.fixtures();
    for (const f of fixtures) await this.repo.upsertMatch(f);
    return fixtures.length;
  }

  /**
   * Ingest a match's ball stream into the append-only store. Feed-down → the match is **suspended**
   * and ingestion stops — no ball is ever fabricated to fill a gap (CRICKET-MVP §2.4, CLAUDE.md §3.10).
   */
  async ingestMatch(feed: CricketFeed, matchId: string): Promise<IngestResult> {
    await this.repo.setStatus(matchId, 'inplay');
    let ingested = 0;
    try {
      for await (const ball of feed.ballEvents(matchId)) {
        if (await this.repo.appendBall(ball)) ingested += 1;
      }
      await this.repo.setStatus(matchId, 'closed');
      return { ingested, suspended: false };
    } catch (e) {
      if (e instanceof FeedUnavailableError) {
        await this.repo.setStatus(matchId, 'suspended');
        return { ingested, suspended: true };
      }
      throw e;
    }
  }
}
