import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database, KYSELY, OperatorActionKind } from '../../db';

@Injectable()
export class TradingRepo {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async createAction(
    kind: OperatorActionKind,
    marketId: string,
    params: unknown,
    proposedBy: string,
  ): Promise<{ id: string }> {
    return this.db
      .insertInto('operator_action')
      .values({ kind, market_id: marketId, params: JSON.stringify(params), proposed_by: proposedBy })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  async findAction(id: string) {
    return this.db.selectFrom('operator_action').selectAll().where('id', '=', id).executeTakeFirst();
  }

  /** Atomically claim a pending action (approve→approved / reject). Returns the row iff it was still pending. */
  async decide(id: string, status: 'approved' | 'rejected', approvedBy: string) {
    return this.db
      .updateTable('operator_action')
      .set({ status, approved_by: approvedBy, decided_at: new Date() })
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .returning('id')
      .executeTakeFirst();
  }

  /** Flip an approved action to executed once its override has run. Idempotent (only approved → executed). */
  async markExecuted(id: string): Promise<void> {
    await this.db
      .updateTable('operator_action')
      .set({ status: 'executed' })
      .where('id', '=', id)
      .where('status', '=', 'approved')
      .execute();
  }

  async pending(limit: number) {
    return this.db
      .selectFrom('operator_action')
      .select(['id', 'kind', 'market_id', 'params', 'proposed_by', 'created_at'])
      .where('status', '=', 'pending')
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();
  }

  /** Approved overrides not yet executed — the startup re-drive re-enqueues these (L1: the enqueue can fail after the claim). */
  async approvedUnexecuted(limit: number) {
    return this.db
      .selectFrom('operator_action')
      .select(['id'])
      .where('status', '=', 'approved')
      .orderBy('decided_at', 'asc')
      .limit(limit)
      .execute();
  }
}
