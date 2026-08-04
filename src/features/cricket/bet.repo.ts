import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { BetSide, BetStatus, Database, KYSELY } from '../../db';
import { chips } from '../../shared/money';
import { BetPosition } from './exposure';

/** What settlement needs about a bet: how to resolve it (side/line), what to pay (potential_payout), and which reservation to move (D35). */
export interface SettlementRow {
  id: string;
  userId: string;
  reservationId: string;
  side: BetSide;
  lineValue: number;
  potentialPayout: bigint;
  status: BetStatus;
}
const SETTLEMENT_COLS = ['id', 'user_id', 'reservation_id', 'side', 'line_value', 'potential_payout', 'status'] as const;
interface SettlementQueryRow {
  id: string;
  user_id: string;
  reservation_id: string;
  side: BetSide;
  line_value: number;
  potential_payout: bigint;
  status: BetStatus;
}
const toSettlementRow = (r: SettlementQueryRow): SettlementRow => ({
  id: r.id,
  userId: r.user_id,
  reservationId: r.reservation_id,
  side: r.side,
  lineValue: r.line_value,
  potentialPayout: r.potential_payout,
  status: r.status,
});

export interface CreateBet {
  idempotencyKey: string;
  userId: string;
  marketId: string;
  matchId: string;
  reservationId: string;
  side: BetSide;
  lineValue: number;
  price: bigint;
  stake: bigint;
  reserved: bigint;
  potentialPayout: bigint;
}

const RETURN_COLS = ['id', 'side', 'stake', 'reserved', 'potential_payout', 'status'] as const;

interface PositionRow {
  side: BetSide;
  reserved: bigint;
  potential_payout: bigint;
}
const toPosition = (r: PositionRow): BetPosition => ({
  side: r.side,
  reserved: chips(r.reserved),
  potentialPayout: chips(r.potential_payout),
});

@Injectable()
export class BetRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async create(b: CreateBet) {
    return this.db
      .insertInto('bet')
      .values({
        idempotency_key: b.idempotencyKey,
        user_id: b.userId,
        market_id: b.marketId,
        match_id: b.matchId,
        reservation_id: b.reservationId,
        side: b.side,
        line_value: b.lineValue,
        price: b.price,
        stake: b.stake,
        reserved: b.reserved,
        potential_payout: b.potentialPayout,
      })
      .returning(RETURN_COLS)
      .executeTakeFirstOrThrow();
  }

  async findByKey(key: string) {
    return this.db
      .selectFrom('bet')
      .select(RETURN_COLS)
      .where('idempotency_key', '=', key)
      .executeTakeFirst();
  }

  async positionsForMarket(marketId: string, limit: number): Promise<BetPosition[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(['side', 'reserved', 'potential_payout'])
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .limit(limit)
      .execute();
    return rows.map(toPosition);
  }

  async positionsForUserMarket(userId: string, marketId: string, limit: number): Promise<BetPosition[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(['side', 'reserved', 'potential_payout'])
      .where('user_id', '=', userId)
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .limit(limit)
      .execute();
    return rows.map(toPosition);
  }

  /** Open bets on a market, everything settlement needs to resolve and pay them (D35). */
  async openBetsForMarket(marketId: string, limit: number): Promise<SettlementRow[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(SETTLEMENT_COLS)
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .limit(limit)
      .execute();
    return rows.map(toSettlementRow);
  }

  /** Already-settled bets on a market — the input to a resettlement recompute (D35). */
  async settledBetsForMarket(marketId: string, limit: number): Promise<SettlementRow[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(SETTLEMENT_COLS)
      .where('market_id', '=', marketId)
      .where('status', 'in', ['won', 'lost', 'void'])
      .limit(limit)
      .execute();
    return rows.map(toSettlementRow);
  }

  async setStatus(betId: string, status: BetStatus): Promise<void> {
    await this.db.updateTable('bet').set({ status }).where('id', '=', betId).execute();
  }
}
