import { Injectable } from '@nestjs/common';
import { BallEvent } from '../../integrations/feed';
import { BetStatus } from '../../db';
import { chips, Chips, ZERO } from '../../shared/money';
import { LedgerService, SettleOutcome } from '../../ledger';
import { AuditService } from '../audit';
import { BetRepo, SettlementRow } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { MarketRepo } from './market.repo';
import { resolveFancyBet, resolveRunnerBet, sessionComplete, sessionRuns } from './settlement';

export class MatchResultError extends Error {}

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
    private readonly audit: AuditService,
  ) {}

  /** Settle every fancy market on a match whose window is complete. Balls are folded once (no N+1). */
  async settleDueMarkets(matchId: string): Promise<MarketSettlement[]> {
    const fancies = await this.markets.fanciesForMatch(matchId, RESETTLE_MAX);
    const balls = await this.cricket.ballsFor(matchId, BALLS_MAX);
    const out: MarketSettlement[] = [];
    for (const f of fancies) out.push(await this.settleFromBalls(f.market_id, f.overs, f.status, balls));
    return out;
  }

  /** Game-integrity guard (audit): bets stranded 'open' on a 'settled' market — always 0 since D44. */
  async strandedBetCount(): Promise<number> {
    return this.bets.countStrandedOpenBets();
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
    const settled = await this.drainOpenBets(marketId, (bet) => {
      if (bet.lineValue === null) throw new Error('fancy market bet without a line');
      return resolveFancyBet(bet.side, bet.lineValue, runs);
    });
    await this.markets.setStatusForMarket(marketId, 'settled');
    return { marketId, status: 'settled', actualRuns: runs, settled };
  }

  /**
   * Settle a match's runner markets (match-odds/bookmaker) from an authoritative declared result (D37):
   * the winning runner name. Stored on the match so settlement is replayable, then each market settles
   * by its matching runner. Validates the winner exists in every unsettled market first — no partial.
   */
  async settleMatchResult(matchId: string, winnerName: string, actor: string): Promise<MarketSettlement[]> {
    const runnerMarkets = (await this.markets.marketsForMatch(matchId, RESETTLE_MAX)).filter(
      (m) => m.market_type === 'match_odds' || m.market_type === 'bookmaker',
    );
    const winnerIdByMarket = new Map<string, string>();
    for (const m of runnerMarkets) {
      if (m.status === 'settled') continue;
      const runners = await this.markets.runnersForMarket(m.id, RESETTLE_MAX);
      const w = runners.find((r) => r.runner_name === winnerName);
      if (!w) throw new MatchResultError(`'${winnerName}' is not a runner in market ${m.id}`);
      winnerIdByMarket.set(m.id, w.id);
    }

    await this.cricket.setResult(matchId, winnerName);
    const out: MarketSettlement[] = [];
    for (const m of runnerMarkets) {
      const winnerId = winnerIdByMarket.get(m.id);
      if (winnerId === undefined) {
        out.push({ marketId: m.id, status: 'already', actualRuns: null, settled: 0 });
        continue;
      }
      await this.markets.setStatusForMarket(m.id, 'suspended');
      const settled = await this.drainOpenBets(m.id, (bet) => {
        if (bet.runnerId === null) throw new Error('runner market bet without a runner');
        return resolveRunnerBet(bet.side, bet.runnerId, winnerId);
      });
      await this.markets.setStatusForMarket(m.id, 'settled');
      out.push({ marketId: m.id, status: 'settled', actualRuns: null, settled });
    }
    await this.audit.record({ actor, action: 'match.result', subject: matchId, after: { winner: winnerName, markets: out.length } });
    return out;
  }

  /** Settle a single runner market (e.g. ball-by-ball) by the winning outcome name — reuses the runner drain. */
  async settleOutcome(marketId: string, winningOutcome: string, actor: string): Promise<MarketSettlement> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (!market) return { marketId, status: 'not-fancy', actualRuns: null, settled: 0 };
    if (market.status === 'settled') return { marketId, status: 'already', actualRuns: null, settled: 0 };
    const winner = (await this.markets.runnersForMarket(marketId, RESETTLE_MAX)).find((r) => r.runner_name === winningOutcome);
    if (!winner) throw new MatchResultError(`'${winningOutcome}' is not a runner in market ${marketId}`);

    await this.markets.setStatusForMarket(marketId, 'suspended');
    const settled = await this.drainOpenBets(marketId, (bet) => {
      if (bet.runnerId === null) throw new Error('runner market bet without a runner');
      return resolveRunnerBet(bet.side, bet.runnerId, winner.id);
    });
    await this.markets.setStatusForMarket(marketId, 'settled');
    await this.audit.record({ actor, action: 'ballbyball.settle', subject: marketId, after: { outcome: winningOutcome, settled } });
    return { marketId, status: 'settled', actualRuns: null, settled };
  }

  /** Void a market (abandonment / no-result, XC4.3): every open bet's stake is returned. Any market type (D37). */
  async voidMarket(marketId: string, actor: string, reason: string): Promise<MarketSettlement> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (!market) return { marketId, status: 'not-fancy', actualRuns: null, settled: 0 };
    if (market.status === 'settled') return { marketId, status: 'already', actualRuns: null, settled: 0 };

    await this.markets.setStatusForMarket(marketId, 'suspended');
    const settled = await this.drainOpenBets(marketId, () => 'void');
    await this.markets.setStatusForMarket(marketId, 'settled');
    await this.audit.record({
      actor,
      action: 'market.void',
      subject: marketId,
      before: { status: market.status },
      after: { status: 'settled', voided: settled },
      reason,
    });
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
      if (bet.lineValue === null) continue; // runner bets aren't resolved from session runs
      const from = bet.status as SettleOutcome; // query excludes 'open'; void skipped above → 'won' | 'lost'
      const to = resolveFancyBet(bet.side, bet.lineValue, runs);
      if (to === from) continue;
      const win = chips(bet.potentialPayout);
      await this.ledger.resettle(bet.reservationId, from, to, win, `resettle:${bet.id}:${correctionId}`, (trx) =>
        this.bets.setStatus(bet.id, to, trx),
      );
      corrected.push({ betId: bet.id, from, to });
    }
    await this.audit.record({
      actor,
      action: 'market.resettle',
      subject: marketId,
      after: { correctionId, corrected },
      reason,
    });
    return corrected;
  }

  /** Settle all open bets on a market, one idempotent ledger settlement each. Drains in batches — no cap. */
  private async drainOpenBets(
    marketId: string,
    outcomeOf: (bet: SettlementRow) => SettleOutcome,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.bets.openBetsForMarket(marketId, SETTLE_BATCH);
      if (batch.length === 0) return total;
      for (const bet of batch) {
        const outcome = outcomeOf(bet);
        const win: Chips = outcome === 'won' ? chips(bet.potentialPayout) : ZERO;
        // Money move and bet-status stamp in ONE transaction (D44). A replayed settle means a concurrent
        // drain already resolved this bet — its hook doesn't run, so we never overwrite the winner's outcome.
        const { replayed } = await this.ledger.settle(bet.reservationId, outcome, win, `settle:${bet.id}`, (trx) =>
          this.bets.setStatus(bet.id, outcome, trx),
        );
        if (!replayed) total += 1;
      }
    }
  }
}
