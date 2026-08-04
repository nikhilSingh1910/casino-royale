import { Kysely, sql } from 'kysely';
import { createDb, Database, migrate } from '../../db';
import { BallEvent, FixtureFeed, MatchFixture, MatchScript } from '../../integrations/feed';
import { chips } from '../../shared/money';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';

const fixture = (matchId: string): MatchFixture => ({
  matchId,
  competition: 'Test League',
  name: 'A v B',
  startsAt: new Date('2026-08-04T08:00:00Z'),
});
const ball = (matchId: string, sequence: number, runs: number): BallEvent => ({
  matchId,
  sequence,
  innings: 1,
  over: Math.floor((sequence - 1) / 6),
  ballInOver: ((sequence - 1) % 6) + 1,
  runsOffBat: runs,
  extras: 0,
  isWicket: false,
  isLegal: true,
});
const script = (matchId: string, runs: number[]): MatchScript => ({
  fixture: fixture(matchId),
  balls: runs.map((r, i) => ball(matchId, i + 1, r)),
});

describe('cricket markets (integration, real Postgres) — CM2', () => {
  let db: Kysely<Database>;
  let cricketRepo: CricketRepo;
  let marketRepo: MarketRepo;
  let market: MarketService;
  let ingest: FeedIngestService;

  beforeAll(async () => {
    db = createDb(TEST_URL);
    await migrate(db);
    cricketRepo = new CricketRepo(db);
    marketRepo = new MarketRepo(db);
    market = new MarketService(marketRepo, cricketRepo);
    ingest = new FeedIngestService(cricketRepo);
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE cricket_match RESTART IDENTITY CASCADE`.execute(db);
    await sql`UPDATE market_config SET enabled = true`.execute(db);
  });

  const line6 = async (matchId: string): Promise<number> => {
    const fancies = await marketRepo.fanciesForMatch(matchId, 100);
    return fancies.find((f) => f.overs === 6)?.line_value ?? -1;
  };

  it('creates all three market groups for a match', async () => {
    const m = 'match-1';
    await cricketRepo.upsertMatch(fixture(m));
    await market.createMarketsForMatch(m, ['NDT', 'ODW']);

    const markets = await market.getMarkets(m);
    const types = markets.map((x) => x.market_type);
    expect(types).toContain('match_odds');
    expect(types).toContain('bookmaker');
    expect(types.filter((t) => t === 'fancy')).toHaveLength(2); // 6 & 10 over runs
  });

  it('reprices session lines on every ball from the feed', async () => {
    const m = 'match-2';
    await cricketRepo.upsertMatch(fixture(m));
    await market.createMarketsForMatch(m, ['A', 'B']);
    const before = await line6(m);

    await ingest.ingestMatch(new FixtureFeed([script(m, [6, 6, 6, 6, 6, 6])]), m, market);

    expect(await line6(m)).toBeGreaterThan(before); // 36 real runs pushed the line up
  });

  it('disable via config suspends a market type; enable restores it (no deploy)', async () => {
    const m = 'match-3';
    await cricketRepo.upsertMatch(fixture(m));
    await market.createMarketsForMatch(m, ['A', 'B']);

    await market.disableType('fancy');
    let markets = await market.getMarkets(m);
    expect(markets.filter((x) => x.market_type === 'fancy').every((x) => x.status === 'suspended')).toBe(true);
    expect(markets.filter((x) => x.market_type === 'match_odds').every((x) => x.status === 'open')).toBe(true);

    await market.enableType('fancy');
    markets = await market.getMarkets(m);
    expect(markets.filter((x) => x.market_type === 'fancy').every((x) => x.status === 'open')).toBe(true);
  });

  it('sets a stake limit via config', async () => {
    await market.setMaxStake('fancy', chips(500));
    expect((await marketRepo.getConfig('fancy'))?.max_stake).toBe(500n);
  });

  it('a suspended match suspends its markets on reprice', async () => {
    const m = 'match-4';
    await cricketRepo.upsertMatch(fixture(m));
    await market.createMarketsForMatch(m, ['A', 'B']);
    await cricketRepo.setStatus(m, 'suspended');

    await market.repriceMatch(m);
    expect((await market.getMarkets(m)).every((x) => x.status === 'suspended')).toBe(true);
  });
});
