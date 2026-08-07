import { Injectable } from '@nestjs/common';
import { Chips } from '../../shared/money';
import { price } from '../../shared/odds';
import { MarketStatus, MarketType } from '../../db';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { MarketRepricer } from './feed-ingest.service';
import { scorecard } from './match-state';
import { priceBallByBall, priceSessionRuns } from './pricing';
import { BallEvent } from '../../integrations/feed';

const FANCY_WINDOWS = [6, 10] as const;
const MARKETS_MAX = 100;
const RUNNERS_MAX = 1200;
const BALLS_MAX = 5000;

export interface RunnerView {
  id: string;
  name: string;
  back: bigint;
  lay: bigint;
}
export interface FancyView {
  line: number;
  overs: number;
  back: bigint;
  lay: bigint;
}
export interface MarketView {
  id: string;
  type: MarketType;
  name: string;
  status: MarketStatus;
  runners: RunnerView[];
  fancy: FancyView | null;
}
export interface MatchView {
  id: string;
  name: string;
  competition: string;
  status: string;
  markets: MarketView[];
}
export interface InningsView {
  innings: number;
  team: string | null;
  runs: number;
  wickets: number;
  overs: string;
}
export interface OverBall {
  runs: number;
  wicket: boolean;
}
export interface RecentBall {
  symbol: string;
  kind: string;
}
export interface ScoreView {
  matchId: string;
  status: string;
  innings: InningsView[];
  currentOver: OverBall[];
  recent: RecentBall[];
  summary: string | null;
}
export interface RunnerPrice {
  back: bigint;
  lay: bigint;
}
export interface MatchListItem {
  id: string;
  name: string;
  competition: string;
  status: string;
  startsAt: Date;
  odds: { home: RunnerPrice | null; draw: RunnerPrice | null; away: RunnerPrice | null };
}

@Injectable()
export class MarketService implements MarketRepricer {
  constructor(
    private readonly repo: MarketRepo,
    private readonly cricketRepo: CricketRepo,
  ) {}

  /** Create all three market groups for a match (XC2.1) — grounded in the HAR market model. */
  async createMarketsForMatch(matchId: string, teams: readonly [string, string]): Promise<void> {
    const mo = await this.repo.createMarket(matchId, 'match_odds', 'Match Odds');
    await this.repo.setRunner(mo.id, teams[0], price(19000), price(21000));
    await this.repo.setRunner(mo.id, teams[1], price(19000), price(21000));

    const bm = await this.repo.createMarket(matchId, 'bookmaker', 'Bookmaker');
    await this.repo.setRunner(bm.id, teams[0], price(18500), price(21500));
    await this.repo.setRunner(bm.id, teams[1], price(18500), price(21500));

    for (const overs of FANCY_WINDOWS) {
      const m = await this.repo.createMarket(matchId, 'fancy', `${overs} over runs`);
      const q = priceSessionRuns(overs, []);
      await this.repo.setFancy(m.id, overs, q.lineValue, q.backPrice, q.layPrice);
    }

    // Ball-by-ball: next-ball outcomes as runners (back-only) — reuses the runner path (D41).
    const bbb = await this.repo.createMarket(matchId, 'ball_by_ball', 'Ball By Ball');
    for (const o of priceBallByBall()) await this.repo.setRunner(bbb.id, o.name, o.price, o.price);
  }

  /** Reprice a match's session lines from the raw ball store (XC2.3). Config- and status-aware. */
  async repriceMatch(matchId: string): Promise<void> {
    const match = await this.cricketRepo.getMatch(matchId);
    if (!match) return;
    if (match.status === 'suspended') {
      await this.repo.setStatusForMatch(matchId, 'suspended');
      return;
    }
    const fancyCfg = await this.repo.getConfig('fancy');
    if (!fancyCfg?.enabled) {
      await this.repo.setStatusForType(matchId, 'fancy', 'suspended');
      return;
    }
    const balls = await this.cricketRepo.ballsFor(matchId, BALLS_MAX);
    const fancies = await this.repo.fanciesForMatch(matchId, MARKETS_MAX);
    for (const f of fancies) {
      const q = priceSessionRuns(f.overs, balls);
      await this.repo.updateFancyLine(f.market_id, q.lineValue, q.backPrice, q.layPrice);
    }
  }

  /** XC2.4 — enable/disable a market type at runtime, no deploy. */
  async disableType(type: MarketType): Promise<void> {
    await this.repo.setEnabled(type, false);
    await this.repo.suspendType(type);
  }
  async enableType(type: MarketType): Promise<void> {
    await this.repo.setEnabled(type, true);
    await this.repo.reopenType(type);
  }
  async setMaxStake(type: MarketType, maxStake: Chips): Promise<void> {
    await this.repo.setMaxStake(type, maxStake);
  }

  getMarkets(matchId: string) {
    return this.repo.marketsForMatch(matchId, MARKETS_MAX);
  }

  getMarket(marketId: string) {
    return this.repo.getMarketWithFancy(marketId);
  }

  /** Operator lock/unlock of a single market (XC5.2). A settled market cannot be reopened. */
  async suspendMarket(marketId: string): Promise<void> {
    await this.repo.setStatusForMarket(marketId, 'suspended');
  }
  async reopenMarket(marketId: string): Promise<void> {
    const m = await this.repo.getMarketWithFancy(marketId);
    if (m?.status === 'suspended') await this.repo.setStatusForMarket(marketId, 'open');
  }

  /** The lobby list — matches with their 1/X/2 match-odds top-of-book (one grouped query, no N+1). */
  async listMatches(): Promise<MatchListItem[]> {
    const matches = await this.cricketRepo.listMatches(MARKETS_MAX);
    const runners = await this.repo.matchOddsRunners(
      matches.map((m) => m.match_id),
      RUNNERS_MAX,
    );
    const byMatch = new Map<string, { name: string; back: bigint; lay: bigint }[]>();
    for (const r of runners) {
      const arr = byMatch.get(r.match_id) ?? [];
      arr.push({ name: r.runner_name, back: r.back_price, lay: r.lay_price });
      byMatch.set(r.match_id, arr);
    }
    return matches.map((m) => ({
      id: m.match_id,
      name: m.name,
      competition: m.competition,
      status: m.status,
      startsAt: m.starts_at,
      odds: oneXtwo(m.name, byMatch.get(m.match_id) ?? []),
    }));
  }

  /** The in-play score strip: per-innings totals + the current over, folded from the raw ball store. */
  async getScore(matchId: string): Promise<ScoreView | null> {
    const match = await this.cricketRepo.getMatch(matchId);
    if (!match) return null;
    const balls = await this.cricketRepo.ballsFor(matchId, BALLS_MAX);
    // Team-per-innings by convention (no toss data, D37): the batting order follows "TeamA v TeamB".
    const teams = match.name.split(/\s+v\s+/i).map((t) => t.trim());

    const sc = scorecard(balls);
    const innings: InningsView[] = sc.innings.map((i) => ({
      innings: i.innings,
      team: teams[i.innings - 1] ?? null,
      runs: i.runs,
      wickets: i.wickets,
      overs: `${Math.floor(i.legalBalls / 6)}.${i.legalBalls % 6}`,
    }));
    const recent = [...balls].sort((a, b) => b.sequence - a.sequence).slice(0, 10).map(recentBall);
    return {
      matchId,
      status: match.status,
      innings,
      currentOver: sc.currentOver.map((b) => ({ runs: b.runsOffBat + b.extras, wicket: b.isWicket })),
      recent,
      summary: summarise(innings),
    };
  }

  /** The market-view payload: a match with its markets, runners and fancy lines. One read per kind (no N+1). */
  async getMatchView(matchId: string): Promise<MatchView | null> {
    const match = await this.cricketRepo.getMatch(matchId);
    if (!match) return null;
    const [markets, runners, fancies] = await Promise.all([
      this.repo.marketsForMatch(matchId, MARKETS_MAX),
      this.repo.runnersForMatch(matchId, RUNNERS_MAX),
      this.repo.fancyLinesForMatch(matchId, MARKETS_MAX),
    ]);

    const runnersByMarket = new Map<string, RunnerView[]>();
    for (const r of runners) {
      const arr = runnersByMarket.get(r.market_id) ?? [];
      arr.push({ id: r.id, name: r.runner_name, back: r.back_price, lay: r.lay_price });
      runnersByMarket.set(r.market_id, arr);
    }
    const fancyByMarket = new Map<string, FancyView>();
    for (const f of fancies) fancyByMarket.set(f.market_id, { line: f.line_value, overs: f.overs, back: f.back_price, lay: f.lay_price });

    return {
      id: match.match_id,
      name: match.name,
      competition: match.competition,
      status: match.status,
      markets: markets.map((m) => ({
        id: m.id,
        type: m.market_type,
        name: m.name,
        status: m.status,
        runners: runnersByMarket.get(m.id) ?? [],
        fancy: fancyByMarket.get(m.id) ?? null,
      })),
    };
  }
}

/** Map a match's match-odds runners to 1 / X / 2 (home / draw / away), by team name with an order fallback. */
function oneXtwo(name: string, runners: { name: string; back: bigint; lay: bigint }[]): MatchListItem['odds'] {
  const [t1 = '', t2 = ''] = name.split(/\s+v\s+/i).map((t) => t.trim());
  const draw = runners.find((r) => /draw/i.test(r.name)) ?? null;
  const nonDraw = runners.filter((r) => r !== draw);
  const home = nonDraw.find((r) => r.name === t1) ?? nonDraw[0] ?? null;
  const away = nonDraw.find((r) => r.name === t2) ?? nonDraw.find((r) => r !== home) ?? null;
  const px = (r: { back: bigint; lay: bigint } | null | undefined) => (r ? { back: r.back, lay: r.lay } : null);
  return { home: px(home), draw: px(draw), away: px(away) };
}

/** Map a ball to the Recent-Result strip's symbol + colour kind. */
function recentBall(b: BallEvent): RecentBall {
  if (b.isWicket) return { symbol: 'W', kind: 'wicket' };
  if (b.extras > 0) return { symbol: 'E', kind: 'extra' };
  const r = b.runsOffBat;
  return { symbol: String(r), kind: r >= 6 ? 'six' : r >= 4 ? 'four' : r === 0 ? 'dot' : 'run' };
}

/** A simple two-innings lead — enough for the strip; not a full chase/target model (deferred). */
function summarise(innings: InningsView[]): string | null {
  const [a, b] = innings;
  if (!a || !b) return null;
  const diff = a.runs - b.runs;
  if (diff === 0) return 'Scores level';
  const leader = diff > 0 ? a : b;
  const by = Math.abs(diff);
  const who = leader.team ?? `Innings ${leader.innings}`;
  return `${who} lead by ${by} run${by === 1 ? '' : 's'}`;
}
