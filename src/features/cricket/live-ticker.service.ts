import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../../shared/config';
import { CricketRepo } from './cricket.repo';
import { inningsOver, nextBall } from './live';
import { MarketService } from './market.service';
import { SettlementService } from './settlement.service';

const BALLS_MAX = 5000;

/**
 * Demo live feed (D43): drips one generated ball into the store per tick, reprices session lines, and
 * auto-settles completed session windows — so scores + markets advance on their own. The frontend polls.
 * OFF unless LIVE_TICK_MS > 0, so it never runs in tests. In prod a real feed adapter replaces this.
 */
@Injectable()
export class LiveTicker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('live-ticker');
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly cricket: CricketRepo,
    private readonly markets: MarketService,
    private readonly settlement: SettlementService,
  ) {}

  onModuleInit(): void {
    const ms = Number(this.config.get('LIVE_TICK_MS')) || 0;
    if (ms <= 0) return;
    this.timer = setInterval(() => void this.tick(), ms);
    this.log.log(`live ticker on — one ball every ${ms}ms`);
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private static readonly DEMO: [string, string][] = [
    ['India', 'Australia'],
    ['England', 'Pakistan'],
    ['South Africa', 'New Zealand'],
  ];

  /** One tick: advance each in-play match by a ball, promote a scheduled one, or seed a demo match. */
  async tick(): Promise<void> {
    if (this.running) return; // never overlap a slow tick
    this.running = true;
    try {
      const live = await this.cricket.matchesByStatus('inplay', 10);
      if (live.length === 0) {
        const [next] = await this.cricket.matchesByStatus('scheduled', 1);
        if (next) await this.cricket.setStatus(next.match_id, 'inplay');
        else await this.seedDemo(); // demo mode only (the ticker is off unless LIVE_TICK_MS > 0)
        return;
      }
      for (const m of live) {
        const balls = await this.cricket.ballsFor(m.match_id, BALLS_MAX);
        if (inningsOver(balls)) {
          await this.cricket.setStatus(m.match_id, 'closed');
          continue;
        }
        await this.cricket.appendBall(nextBall(m.match_id, balls, Math.random()));
        await this.markets.repriceMatch(m.match_id);
        await this.settlement.settleDueMarkets(m.match_id);
      }
    } catch (e) {
      this.log.error(e instanceof Error ? e.message : String(e));
    } finally {
      this.running = false;
    }
  }

  /** Spin up a fresh live demo match so the ticker always has something to advance (demo mode). */
  private async seedDemo(): Promise<void> {
    const pair = LiveTicker.DEMO[Math.floor(Math.random() * LiveTicker.DEMO.length)];
    if (!pair) return;
    const matchId = `demo-${Date.now()}`;
    await this.cricket.upsertMatch({ matchId, competition: 'Kestrel Demo T20', name: `${pair[0]} v ${pair[1]}`, startsAt: new Date() });
    await this.markets.createMarketsForMatch(matchId, pair);
    await this.cricket.setStatus(matchId, 'inplay');
    this.log.log(`seeded demo match ${matchId}`);
  }
}
