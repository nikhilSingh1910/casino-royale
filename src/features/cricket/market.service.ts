import { Injectable } from '@nestjs/common';
import { Chips } from '../../shared/money';
import { price } from '../../shared/odds';
import { MarketStatus, MarketType } from '../../db';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { MarketRepricer } from './feed-ingest.service';
import { priceSessionRuns } from './pricing';

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

  /** The lobby list — matches, soonest first (public read). */
  listMatches() {
    return this.cricketRepo.listMatches(MARKETS_MAX);
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
