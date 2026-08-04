import { Injectable } from '@nestjs/common';
import { add, Chips, chips, ZERO } from '../../shared/money';
import { price, winnings } from '../../shared/odds';
import { BetSide } from '../../db';
import { LedgerService } from '../../ledger';
import { AccountService } from '../identity';
import { BetPosition, calculateCustomerExposure, calculateOperatorLiability } from './exposure';
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

const POSITIONS_MAX = 10000;

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

  async placeBet(input: PlaceBetInput) {
    // Idempotent: the same placement key returns the same bet, no second reservation.
    const existing = await this.bets.findByKey(input.idempotencyKey);
    if (existing) return existing;

    const market = await this.markets.getMarketWithFancy(input.marketId);
    if (!market) throw new BetRejectedError('market not found');
    if (market.status !== 'open') throw new BetRejectedError('market not open'); // lock/suspend (XC3.5)
    if (!market.fancy) throw new BetRejectedError('only fancy markets are supported in CM3');

    const cfg = await this.markets.getConfig(market.market_type);
    if (!cfg?.enabled) throw new BetRejectedError('market type disabled');

    // Two-phase: the user's seen line/price must still be current (XC3.1, anti-courtsiding).
    if (input.seenLineValue !== market.fancy.line_value) throw new BetRejectedError('line moved');
    const currentPrice = input.side === 'back' ? market.fancy.back_price : market.fancy.lay_price;
    if (input.seenPrice !== currentPrice) throw new BetRejectedError('price moved');

    await this.account.assertCanBet(input.userId); // M2 gate
    if ((input.stake as bigint) > cfg.max_stake) throw new BetRejectedError('stake exceeds limit');

    const p = price(input.seenPrice);
    const reserved = input.side === 'back' ? input.stake : winnings(input.stake, p);
    const potentialPayout = input.side === 'back' ? winnings(input.stake, p) : input.stake;

    const bal = await this.ledger.balance(input.userId);
    if ((bal.available as bigint) < (reserved as bigint)) throw new BetRejectedError('insufficient chips');

    // Reserve via the ledger (M1). Same key → whole placement is idempotent (XC3.2, XC3.7).
    // reservationId is DERIVED from the placement key (not random): on a crash-retry between
    // reserve and bets.create, the ledger replays idempotently and skips re-inserting the
    // chip_reservation, so a fresh random id would leave bet.reservation_id pointing at a row
    // that doesn't exist. Deterministic id keeps bet ↔ chip_reservation consistent for CM4.
    const reservationId = `bet:${input.idempotencyKey}`;
    await this.ledger.reserve(input.userId, reservationId, reserved, input.idempotencyKey);

    const bet = await this.bets.create({
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      marketId: input.marketId,
      matchId: market.match_id,
      reservationId,
      side: input.side,
      lineValue: input.seenLineValue,
      price: input.seenPrice,
      stake: input.stake,
      reserved,
      potentialPayout,
    });

    // Liability cap → auto-suspend (XC3.6). session_threshold is the fancy market's cap.
    const liability = calculateOperatorLiability(await this.bets.positionsForMarket(input.marketId, POSITIONS_MAX));
    if ((liability as bigint) > cfg.session_threshold) {
      await this.markets.setStatusForMarket(input.marketId, 'suspended');
    }
    return bet;
  }

  /** CLAUDE.md §5 rule 2 — the same function the risk console uses (XC3.3). */
  async customerExposure(userId: string, marketId: string): Promise<Chips> {
    return calculateCustomerExposure(await this.bets.positionsForUserMarket(userId, marketId, POSITIONS_MAX));
  }

  async operatorLiability(marketId: string): Promise<Chips> {
    return calculateOperatorLiability(await this.bets.positionsForMarket(marketId, POSITIONS_MAX));
  }

  /** Book liability across a whole match — per-market worst cases summed (XC5.1). Reuses §5 rule 11. */
  async operatorLiabilityByMatch(matchId: string): Promise<Chips> {
    const tagged = await this.bets.positionsForMatch(matchId, POSITIONS_MAX);
    const byMarket = new Map<string, BetPosition[]>();
    for (const { marketId, position } of tagged) {
      const arr = byMarket.get(marketId) ?? [];
      arr.push(position);
      byMarket.set(marketId, arr);
    }
    let total = ZERO;
    for (const positions of byMarket.values()) total = add(total, calculateOperatorLiability(positions));
    return total;
  }

  /** Open stake per user on a market — feeds the integrity detector (XC5.4). */
  async stakesByUserForMarket(marketId: string): Promise<{ userId: string; stake: Chips }[]> {
    const rows = await this.bets.stakesByUserForMarket(marketId, POSITIONS_MAX);
    return rows.map((r) => ({ userId: r.userId, stake: chips(r.stake) }));
  }
}
