import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { BetSide, BetStatus, Database, Executor, KYSELY } from '../../db';
import { chips } from '../../shared/money';
import { BetPosition, SESSION_OUTCOME } from './exposure';

/** What settlement needs about a bet: how to resolve it (line or runner), what to pay, which reservation to move (D35/D37). */
export interface SettlementRow {
  id: string;
  userId: string;
  reservationId: string;
  side: BetSide;
  lineValue: number | null;
  runnerId: string | null;
  potentialPayout: bigint;
  status: BetStatus;
}
const SETTLEMENT_COLS = ['id', 'user_id', 'reservation_id', 'side', 'line_value', 'runner_id', 'potential_payout', 'status'] as const;
interface SettlementQueryRow {
  id: string;
  user_id: string;
  reservation_id: string;
  side: BetSide;
  line_value: number | null;
  runner_id: string | null;
  potential_payout: bigint;
  status: BetStatus;
}
const toSettlementRow = (r: SettlementQueryRow): SettlementRow => ({
  id: r.id,
  userId: r.user_id,
  reservationId: r.reservation_id,
  side: r.side,
  lineValue: r.line_value,
  runnerId: r.runner_id,
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
  lineValue: number | null; // fancy selection
  runnerId: string | null; // runner selection (D37) — exactly one of the two is set
  price: bigint;
  stake: bigint;
  reserved: bigint;
  potentialPayout: bigint;
}

const RETURN_COLS = ['id', 'side', 'stake', 'reserved', 'potential_payout', 'status'] as const;

interface PositionRow {
  side: BetSide;
  runner_id: string | null;
  line_value: number | null;
  reserved: string; // SUM() over the group, as text
  potential_payout: string; // SUM() over the group, as text
}
// Positions are aggregated per (side, runner_id, line_value): the worst-case sum distributes, so grouping is exact
// and the result set is bounded by market structure, not bet count — no row-count truncation of the aggregate (H4).
const toPosition = (r: PositionRow): BetPosition => ({
  outcome: r.runner_id ?? SESSION_OUTCOME,
  side: r.side,
  reserved: chips(BigInt(r.reserved)),
  potentialPayout: chips(BigInt(r.potential_payout)),
  line: r.line_value ?? undefined, // the struck line, for fancy bets — drives per-line resolution (H2)
});

/** One player's settled net P&L for the leaderboard (PC5). */
export interface LeaderboardRow {
  userId: string;
  pnl: bigint;
}

/** A bet joined to its match/market context for the account view (PC1). */
export interface BetHistoryRow {
  id: string;
  side: BetSide;
  lineValue: number | null;
  runnerName: string | null;
  price: bigint;
  stake: bigint;
  reserved: bigint;
  potentialPayout: bigint;
  status: BetStatus;
  placedAt: Date;
  matchName: string;
  marketName: string;
  marketType: string;
}

@Injectable()
export class BetRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async create(b: CreateBet, ex: Executor = this.db) {
    return ex
      .insertInto('bet')
      .values({
        idempotency_key: b.idempotencyKey,
        user_id: b.userId,
        market_id: b.marketId,
        match_id: b.matchId,
        reservation_id: b.reservationId,
        side: b.side,
        line_value: b.lineValue,
        runner_id: b.runnerId,
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

  async positionsForMarket(marketId: string, limit: number, ex: Executor = this.db): Promise<BetPosition[]> {
    const rows = await ex
      .selectFrom('bet')
      .select(['side', 'runner_id', 'line_value'])
      .select(sql<string>`COALESCE(SUM(reserved), 0)::text`.as('reserved'))
      .select(sql<string>`COALESCE(SUM(potential_payout), 0)::text`.as('potential_payout'))
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .groupBy(['side', 'runner_id', 'line_value'])
      .limit(limit)
      .execute();
    return rows.map(toPosition);
  }

  async positionsForUserMarket(userId: string, marketId: string, limit: number): Promise<BetPosition[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(['side', 'runner_id', 'line_value'])
      .select(sql<string>`COALESCE(SUM(reserved), 0)::text`.as('reserved'))
      .select(sql<string>`COALESCE(SUM(potential_payout), 0)::text`.as('potential_payout'))
      .where('user_id', '=', userId)
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .groupBy(['side', 'runner_id', 'line_value'])
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

  async setStatus(betId: string, status: BetStatus, ex: Executor = this.db): Promise<void> {
    await ex.updateTable('bet').set({ status }).where('id', '=', betId).execute();
  }

  /** Integrity guard (audit): bets left 'open' on a 'settled' market — D44 makes this 0; this catches a regression. */
  async countStrandedOpenBets(): Promise<number> {
    const r = await this.db
      .selectFrom('bet as b')
      .innerJoin('market as m', 'm.id', 'b.market_id')
      .select(sql<string>`count(*)`.as('n'))
      .where('b.status', '=', 'open')
      .where('m.status', '=', 'settled')
      .executeTakeFirst();
    return Number(r?.n ?? '0');
  }

  /** Open positions across all a match's markets, tagged by market — one query, for match-level liability. */
  async positionsForMatch(matchId: string, limit: number): Promise<{ marketId: string; position: BetPosition }[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select(['market_id', 'side', 'runner_id', 'line_value'])
      .select(sql<string>`COALESCE(SUM(reserved), 0)::text`.as('reserved'))
      .select(sql<string>`COALESCE(SUM(potential_payout), 0)::text`.as('potential_payout'))
      .where('match_id', '=', matchId)
      .where('status', '=', 'open')
      .groupBy(['market_id', 'side', 'runner_id', 'line_value'])
      .limit(limit)
      .execute();
    return rows.map((r) => ({ marketId: r.market_id, position: toPosition(r) }));
  }

  /** Total open stake per user on a market — the input to the concentration integrity flag (XC5.4). */
  async stakesByUserForMarket(marketId: string, limit: number): Promise<{ userId: string; stake: bigint }[]> {
    const rows = await this.db
      .selectFrom('bet')
      .select('user_id')
      .select(sql<string>`COALESCE(SUM(stake), 0)::text`.as('stake'))
      .where('market_id', '=', marketId)
      .where('status', '=', 'open')
      .groupBy('user_id')
      .limit(limit)
      .execute();
    return rows.map((r) => ({ userId: r.user_id, stake: BigInt(r.stake) }));
  }

  /** Top players by settled net P&L (won → +winnings, lost → −reserved, void → 0). Integer SQL, bounded (§3.4). */
  async leaderboard(limit: number): Promise<LeaderboardRow[]> {
    const pnl = sql<string>`SUM(CASE status WHEN 'won' THEN potential_payout WHEN 'lost' THEN -reserved ELSE 0 END)`;
    const rows = await this.db
      .selectFrom('bet')
      .select('user_id')
      .select(pnl.as('pnl'))
      .where('status', 'in', ['won', 'lost', 'void'])
      .groupBy('user_id')
      .orderBy(pnl, 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({ userId: r.user_id, pnl: BigInt(r.pnl) }));
  }

  /** A user's bets, newest first, joined to match/market for the account view (PC1). Bounded (§3.3). */
  async betsForUser(userId: string, limit: number): Promise<BetHistoryRow[]> {
    const rows = await this.db
      .selectFrom('bet as b')
      .innerJoin('market as m', 'm.id', 'b.market_id')
      .innerJoin('cricket_match as c', 'c.match_id', 'b.match_id')
      .leftJoin('market_runner as r', 'r.id', 'b.runner_id')
      .select([
        'b.id',
        'b.side',
        'b.line_value',
        'b.price',
        'b.stake',
        'b.reserved',
        'b.potential_payout',
        'b.status',
        'b.placed_at',
        'm.name as market_name',
        'm.market_type',
        'c.name as match_name',
        'r.runner_name',
      ])
      .where('b.user_id', '=', userId)
      .orderBy('b.placed_at', 'desc')
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      side: r.side,
      lineValue: r.line_value,
      runnerName: r.runner_name,
      price: r.price,
      stake: r.stake,
      reserved: r.reserved,
      potentialPayout: r.potential_payout,
      status: r.status,
      placedAt: r.placed_at,
      matchName: r.match_name,
      marketName: r.market_name,
      marketType: r.market_type,
    }));
  }
}
