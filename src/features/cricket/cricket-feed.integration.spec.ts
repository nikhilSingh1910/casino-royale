import { Kysely, sql } from 'kysely';
import { createDb, Database, migrate } from '../../db';
import { BallEvent, FixtureFeed, MatchFixture, MatchScript } from '../../integrations/feed';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';
import { deriveScore } from './match-state';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

const fixture = (matchId: string): MatchFixture => ({
  matchId,
  competition: 'Test League',
  name: 'A v B',
  startsAt: new Date('2026-08-04T08:00:00Z'),
});
const ball = (matchId: string, sequence: number, runsOffBat: number): BallEvent => ({
  matchId,
  sequence,
  innings: 1,
  over: Math.floor((sequence - 1) / 6),
  ballInOver: ((sequence - 1) % 6) + 1,
  runsOffBat,
  extras: 0,
  isWicket: false,
  isLegal: true,
});
const script = (matchId: string, runs: number[], failAfter?: number): MatchScript => ({
  fixture: fixture(matchId),
  balls: runs.map((r, i) => ball(matchId, i + 1, r)),
  failAfter,
});

describe('cricket feed ingest (integration, real Postgres) — CM1', () => {
  let db: Kysely<Database>;
  let repo: CricketRepo;
  let ingest: FeedIngestService;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    repo = new CricketRepo(db);
    ingest = new FeedIngestService(repo);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE raw_ball_event, cricket_match RESTART IDENTITY CASCADE`.execute(db);
  });

  it('ingests a ball stream into the append-only store, then replays to the same score', async () => {
    const m = 'match-1';
    const feed = new FixtureFeed([script(m, [1, 4, 0, 6, 2, 0])]);
    await ingest.loadFixtures(feed);
    const res = await ingest.ingestMatch(feed, m);

    expect(res.ingested).toBe(6);
    expect(res.suspended).toBe(false);
    expect((await repo.getMatch(m))?.status).toBe('closed');

    const replayed = deriveScore(await repo.ballsFor(m, 1000));
    expect(replayed.runs).toBe(13);
    expect(replayed.legalBalls).toBe(6);
  });

  it('feed-down suspends the match and fabricates nothing', async () => {
    const m = 'match-2';
    const feed = new FixtureFeed([script(m, [1, 1, 1, 1, 1, 1], 3)]); // outage after 3
    await ingest.loadFixtures(feed);
    const res = await ingest.ingestMatch(feed, m);

    expect(res.suspended).toBe(true);
    expect(res.ingested).toBe(3);
    expect((await repo.getMatch(m))?.status).toBe('suspended');
    expect((await repo.ballsFor(m, 1000)).length).toBe(3); // only what arrived — nothing invented
  });

  it('is idempotent — re-ingesting the same match adds no duplicates', async () => {
    const m = 'match-3';
    const feed = new FixtureFeed([script(m, [2, 2, 2])]);
    await ingest.loadFixtures(feed);
    await ingest.ingestMatch(feed, m);
    const second = await ingest.ingestMatch(feed, m);

    expect(second.ingested).toBe(0);
    expect((await repo.ballsFor(m, 1000)).length).toBe(3);
  });

  it('replays correctly even when balls are stored out of order', async () => {
    const m = 'match-4';
    await repo.upsertMatch(fixture(m));
    await repo.appendBall(ball(m, 3, 6));
    await repo.appendBall(ball(m, 1, 4));
    await repo.appendBall(ball(m, 2, 1));

    const balls = await repo.ballsFor(m, 1000);
    expect(balls.map((b) => b.sequence)).toEqual([1, 2, 3]);
    expect(deriveScore(balls).runs).toBe(11);
  });
});
