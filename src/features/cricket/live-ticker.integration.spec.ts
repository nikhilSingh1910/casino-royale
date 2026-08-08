import { Test } from '@nestjs/testing';
import { Kysely, sql } from 'kysely';
import { Database, KYSELY, migrate } from '../../db';
import { ConfigService } from '../../shared/config';
import { CricketModule } from './cricket.module';
import { CricketRepo, MarketService } from './index';
import { LiveTicker } from './live-ticker.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

describe('live ticker (integration, real Postgres) — D43', () => {
  let db: Kysely<Database>;
  let ticker: LiveTicker;
  let cricket: CricketRepo;
  let markets: MarketService;

  beforeAll(async () => {
    const cfg = { get: (k: string) => ({ DATABASE_URL: TEST_URL, NODE_ENV: 'test', FEED_SOURCE: 'fixture', LOG_LEVEL: 'silent', PORT: 3000, LIVE_TICK_MS: 0 })[k] };
    const moduleRef = await Test.createTestingModule({ imports: [CricketModule] }).overrideProvider(ConfigService).useValue(cfg).compile();
    db = moduleRef.get<Kysely<Database>>(KYSELY, { strict: false });
    await migrate(db);
    ticker = moduleRef.get(LiveTicker, { strict: false });
    cricket = moduleRef.get(CricketRepo, { strict: false });
    markets = moduleRef.get(MarketService, { strict: false });
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE cricket_match, market, market_runner, fancy_market, raw_ball_event RESTART IDENTITY CASCADE`.execute(db);
  });

  it('brings a scheduled match to life, then advances it a ball per tick', async () => {
    await cricket.upsertMatch({ matchId: 'live1', competition: 'T', name: 'A v B', startsAt: new Date('2026-08-09T08:00:00Z') });
    await markets.createMarketsForMatch('live1', ['A', 'B']);
    expect((await cricket.getMatch('live1'))?.status).toBe('scheduled');

    await ticker.tick(); // no match in-play yet → promote the scheduled one
    expect((await cricket.getMatch('live1'))?.status).toBe('inplay');
    expect(await cricket.ballsFor('live1', 100)).toHaveLength(0);

    await ticker.tick(); // now in-play → one ball
    await ticker.tick(); // → two balls
    const balls = await cricket.ballsFor('live1', 100);
    expect(balls).toHaveLength(2);
    expect(balls[0]?.sequence).toBe(1);
    expect(balls[1]?.sequence).toBe(2);

    // the score endpoint reflects the advancing match
    const score = await markets.getScore('live1');
    expect(score?.innings[0]?.innings).toBe(1);
    expect(score?.recent.length).toBe(2);
  });
});
