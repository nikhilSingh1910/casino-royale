import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database, Executor, KYSELY, MarketStatus, MarketType } from '../../db';

@Injectable()
export class MarketRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async createMarket(matchId: string, type: MarketType, name: string): Promise<{ id: string }> {
    return this.db
      .insertInto('market')
      .values({ match_id: matchId, market_type: type, name })
      .onConflict((oc) => oc.columns(['match_id', 'market_type', 'name']).doUpdateSet({ name }))
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  async setRunner(marketId: string, name: string, backPrice: bigint, layPrice: bigint): Promise<void> {
    await this.db
      .insertInto('market_runner')
      .values({ market_id: marketId, runner_name: name, back_price: backPrice, lay_price: layPrice })
      .onConflict((oc) =>
        oc.columns(['market_id', 'runner_name']).doUpdateSet({ back_price: backPrice, lay_price: layPrice }),
      )
      .execute();
  }

  async setFancy(marketId: string, overs: number, line: number, backPrice: bigint, layPrice: bigint): Promise<void> {
    await this.db
      .insertInto('fancy_market')
      .values({ market_id: marketId, overs, line_value: line, back_price: backPrice, lay_price: layPrice })
      .onConflict((oc) =>
        oc.column('market_id').doUpdateSet({ line_value: line, back_price: backPrice, lay_price: layPrice, updated_at: new Date() }),
      )
      .execute();
  }

  async updateFancyLine(marketId: string, line: number, backPrice: bigint, layPrice: bigint): Promise<void> {
    await this.db
      .updateTable('fancy_market')
      .set({ line_value: line, back_price: backPrice, lay_price: layPrice, updated_at: new Date() })
      .where('market_id', '=', marketId)
      .execute();
  }

  async setStatusForMatch(matchId: string, status: MarketStatus): Promise<void> {
    await this.db.updateTable('market').set({ status }).where('match_id', '=', matchId).execute();
  }

  async setStatusForType(matchId: string, type: MarketType, status: MarketStatus): Promise<void> {
    await this.db
      .updateTable('market')
      .set({ status })
      .where('match_id', '=', matchId)
      .where('market_type', '=', type)
      .execute();
  }

  async suspendType(type: MarketType): Promise<void> {
    await this.db
      .updateTable('market')
      .set({ status: 'suspended' })
      .where('market_type', '=', type)
      .where('status', '=', 'open')
      .execute();
  }

  async reopenType(type: MarketType): Promise<void> {
    await this.db
      .updateTable('market')
      .set({ status: 'open' })
      .where('market_type', '=', type)
      .where('status', '=', 'suspended')
      .execute();
  }

  async marketsForMatch(matchId: string, limit: number) {
    return this.db
      .selectFrom('market')
      .select(['id', 'market_type', 'name', 'status'])
      .where('match_id', '=', matchId)
      .orderBy('market_type', 'asc')
      .limit(limit)
      .execute();
  }

  async fanciesForMatch(matchId: string, limit: number) {
    return this.db
      .selectFrom('fancy_market as f')
      .innerJoin('market as m', 'm.id', 'f.market_id')
      .select(['f.market_id', 'f.overs', 'f.line_value', 'm.status'])
      .where('m.match_id', '=', matchId)
      .limit(limit)
      .execute();
  }

  async getConfig(type: MarketType) {
    return this.db
      .selectFrom('market_config')
      .selectAll()
      .where('market_type', '=', type)
      .executeTakeFirst();
  }

  async setEnabled(type: MarketType, enabled: boolean): Promise<void> {
    await this.db.updateTable('market_config').set({ enabled }).where('market_type', '=', type).execute();
  }

  async setMaxStake(type: MarketType, maxStake: bigint): Promise<void> {
    await this.db.updateTable('market_config').set({ max_stake: maxStake }).where('market_type', '=', type).execute();
  }

  async getMarketWithFancy(marketId: string) {
    const m = await this.db
      .selectFrom('market')
      .select(['id', 'match_id', 'market_type', 'status'])
      .where('id', '=', marketId)
      .executeTakeFirst();
    if (!m) return undefined;
    const fancy = await this.db
      .selectFrom('fancy_market')
      .select(['overs', 'line_value', 'back_price', 'lay_price'])
      .where('market_id', '=', marketId)
      .executeTakeFirst();
    return { ...m, fancy: fancy ?? null };
  }

  async setStatusForMarket(marketId: string, status: MarketStatus, ex: Executor = this.db): Promise<void> {
    await ex.updateTable('market').set({ status }).where('id', '=', marketId).execute();
  }

  /** Guarded, atomic operator transition — applies only from `from`; returns whether it did. A settled market can't be clobbered (H1). */
  async transitionStatus(marketId: string, from: MarketStatus, to: MarketStatus, ex: Executor = this.db): Promise<boolean> {
    const res = await ex.updateTable('market').set({ status: to }).where('id', '=', marketId).where('status', '=', from).executeTakeFirst();
    return (res?.numUpdatedRows ?? 0n) > 0n;
  }

  /** The market's status under a row lock — placement re-checks it inside the reserve txn (D44). */
  async statusForUpdate(ex: Executor, marketId: string): Promise<MarketStatus | undefined> {
    const r = await ex.selectFrom('market').select('status').where('id', '=', marketId).forUpdate().executeTakeFirst();
    return r?.status;
  }

  async getRunner(runnerId: string) {
    return this.db
      .selectFrom('market_runner')
      .select(['id', 'market_id', 'runner_name', 'back_price', 'lay_price'])
      .where('id', '=', runnerId)
      .executeTakeFirst();
  }

  async runnersForMarket(marketId: string, limit: number) {
    return this.db
      .selectFrom('market_runner')
      .select(['id', 'runner_name'])
      .where('market_id', '=', marketId)
      .limit(limit)
      .execute();
  }

  /** All of a match's runners with prices, tagged by market — one query for the market view (no N+1). */
  async runnersForMatch(matchId: string, limit: number) {
    return this.db
      .selectFrom('market_runner as r')
      .innerJoin('market as m', 'm.id', 'r.market_id')
      .select(['r.market_id', 'r.id', 'r.runner_name', 'r.back_price', 'r.lay_price'])
      .where('m.match_id', '=', matchId)
      .limit(limit)
      .execute();
  }

  /** Match-odds runners across many matches — one query for the lobby's 1/X/2 columns (no N+1). */
  async matchOddsRunners(matchIds: readonly string[], limit: number) {
    if (matchIds.length === 0) return [];
    return this.db
      .selectFrom('market_runner as r')
      .innerJoin('market as m', 'm.id', 'r.market_id')
      .select(['m.match_id', 'r.runner_name', 'r.back_price', 'r.lay_price'])
      .where('m.market_type', '=', 'match_odds')
      .where('m.match_id', 'in', [...matchIds])
      .limit(limit)
      .execute();
  }

  /** All of a match's fancy lines with prices, tagged by market — one query for the market view. */
  async fancyLinesForMatch(matchId: string, limit: number) {
    return this.db
      .selectFrom('fancy_market as f')
      .innerJoin('market as m', 'm.id', 'f.market_id')
      .select(['f.market_id', 'f.overs', 'f.line_value', 'f.back_price', 'f.lay_price'])
      .where('m.match_id', '=', matchId)
      .limit(limit)
      .execute();
  }
}
