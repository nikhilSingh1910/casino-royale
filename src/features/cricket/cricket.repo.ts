import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database, KYSELY } from '../../db';
import { BallEvent, MatchFixture, MatchStatus } from '../../integrations/feed';

@Injectable()
export class CricketRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async upsertMatch(f: MatchFixture): Promise<void> {
    await this.db
      .insertInto('cricket_match')
      .values({ match_id: f.matchId, competition: f.competition, name: f.name, starts_at: f.startsAt })
      .onConflict((oc) => oc.column('match_id').doNothing())
      .execute();
  }

  async setStatus(matchId: string, status: MatchStatus): Promise<void> {
    await this.db
      .updateTable('cricket_match')
      .set({ status, updated_at: new Date() })
      .where('match_id', '=', matchId)
      .execute();
  }

  async getMatch(matchId: string) {
    return this.db
      .selectFrom('cricket_match')
      .select(['match_id', 'competition', 'name', 'status'])
      .where('match_id', '=', matchId)
      .executeTakeFirst();
  }

  /** Append a ball idempotently. True if newly inserted, false if a duplicate (match_id, sequence). */
  async appendBall(b: BallEvent): Promise<boolean> {
    const res = await this.db
      .insertInto('raw_ball_event')
      .values({
        match_id: b.matchId,
        sequence: b.sequence,
        innings: b.innings,
        over: b.over,
        ball_in_over: b.ballInOver,
        runs_off_bat: b.runsOffBat,
        extras: b.extras,
        is_wicket: b.isWicket,
        is_legal: b.isLegal,
      })
      .onConflict((oc) => oc.columns(['match_id', 'sequence']).doNothing())
      .executeTakeFirst();
    return (res.numInsertedOrUpdatedRows ?? 0n) > 0n;
  }

  /** Raw ball events for a match in sequence order, bounded by `limit` (CLAUDE.md §3.3). */
  async ballsFor(matchId: string, limit: number): Promise<BallEvent[]> {
    const rows = await this.db
      .selectFrom('raw_ball_event')
      .selectAll()
      .where('match_id', '=', matchId)
      .orderBy('sequence', 'asc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      matchId: r.match_id,
      sequence: r.sequence,
      innings: r.innings,
      over: r.over,
      ballInOver: r.ball_in_over,
      runsOffBat: r.runs_off_bat,
      extras: r.extras,
      isWicket: r.is_wicket,
      isLegal: r.is_legal,
    }));
  }
}
