import { Injectable } from '@nestjs/common';
import { add, Chips, chips, ZERO } from '../../shared/money';
import { price, winnings } from '../../shared/odds';
import { BetSide } from '../../db';
import { LedgerService } from '../../ledger';
import { AccountService } from '../identity';
import { BetPosition, calculateCustomerExposure, calculateOperatorLiability, SESSION_SCENARIOS } from './exposure';
import { BetRepo } from './bet.repo';
import { MarketRepo } from './market.repo';

export class BetRejectedError extends Error {}

export interface PlaceBetInput {
  userId: string;
  marketId: string;
  side: BetSide;
  stake: Chips;
  seenLineValue: number;
  seenPrice: bigint;
  idempotencyKey: string;
}

/** A bet on a runner market (match-odds/bookmaker) — selects a runner, two-phase on that runner's price (D37). */
export interface PlaceRunnerBetInput {
  userId: string;
  marketId: string;
  runnerId: string;
  side: BetSide;
  stake: Chips;
  seenPrice: bigint;
  idempotencyKey: string;
}

interface ReserveArgs {
  userId: string;
  marketId: string;
  matchId: string;
  side: BetSide;
  stake: Chips;
  idempotencyKey: string;
  priceScaled: bigint;
  lineValue: number | null;
  runnerId: string | null;
  cfg: { max_stake: bigint; session_threshold: bigint };
}

const POSITIONS_MAX = 10000;
const RUNNERS_MAX = 1200;
const MARKETS_MAX = 100;

/**
 * Where a bet is placed (CM3). Ties M1 (reserve), M2 (assertCanBet), CM2 (markets/config). Two-phase
 * against the live line, full-stake reservation via the ledger, idempotent by the placement key.
 * CM3 targets fancy/session markets (the HAR's core product); runner-based match-odds is a follow-up.
 */
@Injectable()
export class PlacementService {
  constructor(
    private readonly markets: MarketRepo,
    private readonly ledger: LedgerService,
    private readonly account: AccountService,
    private readonly bets: BetRepo,
  ) {}

  /** Place a fancy/session bet — two-phase against the live line + price (XC3.1). */
  async placeBet(input: PlaceBetInput) {
    const existing = await this.bets.findByKey(input.idempotencyKey);
    if (existing) return existing;

    const market = await this.markets.getMarketWithFancy(input.marketId);
    if (!market) throw new BetRejectedError('market not found');
    if (market.status !== 'open') throw new BetRejectedError('market not open'); // lock/suspend (XC3.5)
    if (!market.fancy) throw new BetRejectedError('only fancy markets take a line bet');

    const cfg = await this.markets.getConfig(market.market_type);
    if (!cfg?.enabled) throw new BetRejectedError('market type disabled');

    // Two-phase: the user's seen line/price must still be current (XC3.1, anti-courtsiding).
    if (input.seenLineValue !== market.fancy.line_value) throw new BetRejectedError('line moved');
    const currentPrice = input.side === 'back' ? market.fancy.back_price : market.fancy.lay_price;
    if (input.seenPrice !== currentPrice) throw new BetRejectedError('price moved');

    return this.reserveAndCreate({
      userId: input.userId,
      marketId: input.marketId,
      matchId: market.match_id,
      side: input.side,
      stake: input.stake,
      idempotencyKey: input.idempotencyKey,
      priceScaled: input.seenPrice,
      lineValue: input.seenLineValue,
      runnerId: null,
      cfg,
    });
  }

  /** Place a match-odds/bookmaker bet — two-phase against the live runner price (D37). */
  async placeRunnerBet(input: PlaceRunnerBetInput) {
    const existing = await this.bets.findByKey(input.idempotencyKey);
    if (existing) return existing;

    const market = await this.markets.getMarketWithFancy(input.marketId);
    if (!market) throw new BetRejectedError('market not found');
    if (market.status !== 'open') throw new BetRejectedError('market not open');
    if (market.market_type === 'fancy') throw new BetRejectedError('not a runner market'); // fancy uses placeBet

    const cfg = await this.markets.getConfig(market.market_type);
    if (!cfg?.enabled) throw new BetRejectedError('market type disabled');

    const runner = await this.markets.getRunner(input.runnerId);
    if (!runner || runner.market_id !== input.marketId) throw new BetRejectedError('runner not in market');
    const currentPrice = input.side === 'back' ? runner.back_price : runner.lay_price;
    if (input.seenPrice !== currentPrice) throw new BetRejectedError('price moved');

    return this.reserveAndCreate({
      userId: input.userId,
      marketId: input.marketId,
      matchId: market.match_id,
      side: input.side,
      stake: input.stake,
      idempotencyKey: input.idempotencyKey,
      priceScaled: input.seenPrice,
      lineValue: null,
      runnerId: input.runnerId,
      cfg,
    });
  }

  /**
   * The one money-path shared by both placement kinds (§3.2): M2 gate → reserve + market re-check +
   * bet row + liability cap, all in ONE ledger transaction (D44). The in-txn `statusForUpdate` lock
   * serialises against settlement's suspend→drain, so a bet can't strand 'open' on a 'settled' market
   * and two bets can't both slip under the cap; if anything throws, the reservation rolls back — no orphan.
   */
  private async reserveAndCreate(a: ReserveArgs) {
    await this.account.assertCanBet(a.userId); // M2 gate
    if ((a.stake as bigint) > a.cfg.max_stake) throw new BetRejectedError('stake exceeds limit');

    const p = price(a.priceScaled);
    const reserved = a.side === 'back' ? a.stake : winnings(a.stake, p);
    const potentialPayout = a.side === 'back' ? winnings(a.stake, p) : a.stake;

    const bal = await this.ledger.balance(a.userId);
    if ((bal.available as bigint) < (reserved as bigint)) throw new BetRejectedError('insufficient chips');

    const reservationId = `bet:${a.idempotencyKey}`;
    let created: Awaited<ReturnType<BetRepo['create']>> | undefined;
    await this.ledger.reserve(a.userId, reservationId, reserved, a.idempotencyKey, async (trx) => {
      if ((await this.markets.statusForUpdate(trx, a.marketId)) !== 'open') throw new BetRejectedError('market not open');
      created = await this.bets.create(
        {
          idempotencyKey: a.idempotencyKey,
          userId: a.userId,
          marketId: a.marketId,
          matchId: a.matchId,
          reservationId,
          side: a.side,
          lineValue: a.lineValue,
          runnerId: a.runnerId,
          price: a.priceScaled,
          stake: a.stake,
          reserved,
          potentialPayout,
        },
        trx,
      );
      // Runner markets carry threshold 0 = off (D37): the binary liability formula has no multi-runner worst case.
      if ((a.cfg.session_threshold as bigint) > 0n) {
        // The cap only runs for fancy markets (threshold > 0), so their two session scenarios apply.
        const liability = calculateOperatorLiability(await this.bets.positionsForMarket(a.marketId, POSITIONS_MAX, trx), SESSION_SCENARIOS);
        if ((liability as bigint) > a.cfg.session_threshold) await this.markets.setStatusForMarket(a.marketId, 'suspended', trx);
      }
    });
    if (created) return created;
    const existing = await this.bets.findByKey(a.idempotencyKey); // reserve replayed (concurrent same key) → the winner's bet
    if (existing) return existing;
    throw new BetRejectedError('placement could not be completed');
  }

  /** CLAUDE.md §5 rule 2 — the same function the risk console uses (XC3.3), across the market's outcomes. */
  async customerExposure(userId: string, marketId: string): Promise<Chips> {
    const [positions, scenarios] = await Promise.all([
      this.bets.positionsForUserMarket(userId, marketId, POSITIONS_MAX),
      this.scenariosFor(marketId),
    ]);
    return calculateCustomerExposure(positions, scenarios);
  }

  async operatorLiability(marketId: string): Promise<Chips> {
    const [positions, scenarios] = await Promise.all([
      this.bets.positionsForMarket(marketId, POSITIONS_MAX),
      this.scenariosFor(marketId),
    ]);
    return calculateOperatorLiability(positions, scenarios);
  }

  /** A market's possible resolutions: its runners (runner markets), or line reached / missed (fancy). */
  private async scenariosFor(marketId: string): Promise<readonly string[]> {
    const market = await this.markets.getMarketWithFancy(marketId);
    if (market?.fancy) return SESSION_SCENARIOS;
    return (await this.markets.runnersForMarket(marketId, RUNNERS_MAX)).map((r) => r.id);
  }

  /** Book liability across a whole match — per-market worst cases summed (XC5.1). Reuses §5 rule 11. */
  async operatorLiabilityByMatch(matchId: string): Promise<Chips> {
    const [tagged, mkts, runners] = await Promise.all([
      this.bets.positionsForMatch(matchId, POSITIONS_MAX),
      this.markets.marketsForMatch(matchId, MARKETS_MAX),
      this.markets.runnersForMatch(matchId, RUNNERS_MAX),
    ]);
    const runnerIdsByMarket = new Map<string, string[]>();
    for (const r of runners) runnerIdsByMarket.set(r.market_id, [...(runnerIdsByMarket.get(r.market_id) ?? []), r.id]);
    const positionsByMarket = new Map<string, BetPosition[]>();
    for (const { marketId, position } of tagged) positionsByMarket.set(marketId, [...(positionsByMarket.get(marketId) ?? []), position]);

    let total = ZERO;
    for (const [mid, positions] of positionsByMarket) {
      const scenarios = mkts.find((m) => m.id === mid)?.market_type === 'fancy' ? SESSION_SCENARIOS : (runnerIdsByMarket.get(mid) ?? []);
      total = add(total, calculateOperatorLiability(positions, scenarios));
    }
    return total;
  }

  /** Open stake per user on a market — feeds the integrity detector (XC5.4). */
  async stakesByUserForMarket(marketId: string): Promise<{ userId: string; stake: Chips }[]> {
    const rows = await this.bets.stakesByUserForMarket(marketId, POSITIONS_MAX);
    return rows.map((r) => ({ userId: r.userId, stake: chips(r.stake) }));
  }
}
