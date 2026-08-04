import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { BetSide, Database, KYSELY } from '../../db';
import { chips } from '../../shared/money';
import { BetPosition } from './exposure';

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
}
