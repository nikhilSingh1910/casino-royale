import { Injectable } from '@nestjs/common';
import { BallEvent } from '../../integrations/feed';
import { BetSide, BetStatus } from '../../db';
import { chips, Chips, ZERO } from '../../shared/money';
import { LedgerService, SettleOutcome } from '../../ledger';
import { IdentityRepo } from '../identity';
import { BetRepo } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { resolveFancyBet, sessionComplete, sessionRuns } from './settlement';

const BALLS_MAX = 5000; // a T20 innings is ~130 legal balls; ample headroom
const SETTLE_BATCH = 1000;
const RESETTLE_MAX = 100000;

export type SettleStatus = 'settled' | 'pending' | 'already' | 'not-fancy';
export interface MarketSettlement {
  marketId: string;
  status: SettleStatus;
  actualRuns: number | null;
  settled: number;
}
export interface Correction {
  betId: string;
  from: BetStatus;
  to: BetStatus;
}

/**
 * Settles fancy/session markets from the append-only ball store (D35) — the platform disposes, the
 * feed only proposes. Money moves solely through the ledger; the resolver is pure and replayable.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly markets: MarketRepo,
    private readonly bets: BetRepo,
    private readonly cricket: CricketRepo,
    private readonly ledger: LedgerService,
    private readonly identity: IdentityRepo,
  ) {}

  /** Settle every fancy market on a match whose window is complete. Balls are folded once (no N+1). */
  async settleDueMarkets(matchId: string): Promise<MarketSettlement[]> {
    const fancies = await this.markets.fanciesForMatch(matchId, RESETTLE_MAX);
    const balls = await this.cricket.ballsFor(matchId, BALLS_MAX);
    const out: MarketSettlement[] = [];
    for (const f of fancies) out.push(await this.settleFromBalls(f.market_id, f.overs, f.status, balls));
    return out;
  }

  async settleFancyMarket(marketId: string): Promise<MarketSettlement> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (!market || !market.fancy) return { marketId, status: 'not-fancy', actualRuns: null, settled: 0 };
    const balls = await this.cricket.ballsFor(market.match_id, BALLS_MAX);
    return this.settleFromBalls(marketId, market.fancy.overs, market.status, balls);
  }

  private async settleFromBalls(
    marketId: string,
    overs: number,
    status: string,
    balls: readonly BallEvent[],
  ): Promise<MarketSettlement> {
    if (status === 'settled') return { marketId, status: 'already', actualRuns: null, settled: 0 };
    if (!sessionComplete(balls, overs)) return { marketId, status: 'pending', actualRuns: null, settled: 0 };

    const runs = sessionRuns(balls, overs);
    // Lock betting before settling so no bet can be placed against a window that's already resolved.
    await this.markets.setStatusForMarket(marketId, 'suspended');
    const settled = await this.drainOpenBets(marketId, (side, line) => resolveFancyBet(side, line, runs));
    await this.markets.setStatusForMarket(marketId, 'settled');
    return { marketId, status: 'settled', actualRuns: runs, settled };
  }

  /** Void a fancy market (abandonment / no-result, XC4.3): every open bet's stake is returned. */
  async voidFancyMarket(marketId: string, actor: string, reason: string): Promise<MarketSettlement> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (!market || !market.fancy) return { marketId, status: 'not-fancy', actualRuns: null, settled: 0 };
    if (market.status === 'settled') return { marketId, status: 'already', actualRuns: null, settled: 0 };

    await this.markets.setStatusForMarket(marketId, 'suspended');
    const settled = await this.drainOpenBets(marketId, () => 'void');
    await this.markets.setStatusForMarket(marketId, 'settled');
    await this.identity.audit(actor, 'market.void', marketId, { reason, voided: settled });
    return { marketId, status: 'settled', actualRuns: null, settled };
  }

  /**
   * Resettle a settled market after a corrected result (XC4.4): recompute each bet, and where the
   * outcome flipped, post ONE compensating ledger transaction (D35). Idempotent by correctionId.
   */
  async resettleFancyMarket(
    marketId: string,
    actor: string,
    reason: string,
    correctionId: string,
  ): Promise<Correction[]> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (!market || !market.fancy || market.status !== 'settled') return [];
    const balls = await this.cricket.ballsFor(market.match_id, BALLS_MAX);
    const runs = sessionRuns(balls, market.fancy.overs);

    const bets = await this.bets.settledBetsForMarket(marketId, RESETTLE_MAX);
    const corrected: Correction[] = [];
    for (const bet of bets) {
      if (bet.status === 'void') continue; // a void is a deliberate action, not runs-derived
      const from = bet.status as SettleOutcome; // query excludes 'open'; void skipped above → 'won' | 'lost'
      const to = resolveFancyBet(bet.side, bet.lineValue, runs);
      if (to === from) continue;
      const win = chips(bet.potentialPayout);
      await this.ledger.resettle(bet.reservationId, from, to, win, `resettle:${bet.id}:${correctionId}`);
      await this.bets.setStatus(bet.id, to);
      corrected.push({ betId: bet.id, from, to });
    }
    await this.identity.audit(actor, 'market.resettle', marketId, { reason, correctionId, corrected });
    return corrected;
  }

  /** Settle all open bets on a market, one idempotent ledger settlement each. Drains in batches — no cap. */
  private async drainOpenBets(
    marketId: string,
    outcomeOf: (side: BetSide, line: number) => SettleOutcome,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.bets.openBetsForMarket(marketId, SETTLE_BATCH);
      if (batch.length === 0) return total;
      for (const bet of batch) {
        const outcome = outcomeOf(bet.side, bet.lineValue);
        const win: Chips = outcome === 'won' ? chips(bet.potentialPayout) : ZERO;
        await this.ledger.settle(bet.reservationId, outcome, win, `settle:${bet.id}`);
        await this.bets.setStatus(bet.id, outcome);
        total += 1;
      }
    }
  }
}
