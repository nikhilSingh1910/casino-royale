import { Injectable } from '@nestjs/common';
import { Chips } from '../../shared/money';
import { OperatorActionKind } from '../../db';
import { AuditService } from '../audit';
import { MarketService, PlacementService, SettlementService } from '../cricket';
import { JobQueue } from '../../jobs';
import { ActionNotFoundError, ActionNotPendingError, SoDViolationError } from './errors';
import { flagConcentration, IntegrityFlag } from './integrity';
import { TradingRepo } from './trading.repo';

export interface ProposalParams {
  reason: string;
  correctionId?: string;
}
export type ApproveResult = { kind: OperatorActionKind; actionId: string };

/** Durable queue name for executing an approved four-eyes override (D45b). */
export const EXECUTE_OVERRIDE = 'execute-override';

const FLAG_MAX = 1000;

/**
 * The operator console (D36). Reversible market locks are single-auth + audited; money-affecting
 * overrides (void/resettle) are proposed by one operator and approved by another (four-eyes, XC5.2),
 * executed through CM4's settlement mechanics. Every action writes through the C4 AuditService.
 */
@Injectable()
export class TradingService {
  constructor(
    private readonly actions: TradingRepo,
    private readonly markets: MarketService,
    private readonly settlement: SettlementService,
    private readonly placement: PlacementService,
    private readonly audit: AuditService,
    private readonly jobs: JobQueue,
  ) {}

  // ---- reversible market locks (single-auth) --------------------------------

  async suspendMarket(marketId: string, operator: string): Promise<void> {
    const before = await this.markets.getMarket(marketId);
    await this.markets.suspendMarket(marketId);
    await this.audit.record({
      actor: operator,
      action: 'market.suspend',
      subject: marketId,
      before: { status: before?.status ?? null },
      after: { status: 'suspended' },
    });
  }

  async reopenMarket(marketId: string, operator: string): Promise<void> {
    const before = await this.markets.getMarket(marketId);
    await this.markets.reopenMarket(marketId);
    const after = await this.markets.getMarket(marketId);
    await this.audit.record({
      actor: operator,
      action: 'market.reopen',
      subject: marketId,
      before: { status: before?.status ?? null },
      after: { status: after?.status ?? null },
    });
  }

  // ---- dual-auth money overrides (four-eyes) --------------------------------

  async propose(
    kind: OperatorActionKind,
    marketId: string,
    params: ProposalParams,
    adjuster: string,
  ): Promise<{ id: string }> {
    const { id } = await this.actions.createAction(kind, marketId, params, adjuster);
    await this.audit.record({ actor: adjuster, action: `action.propose.${kind}`, subject: marketId, after: { actionId: id, params } });
    return { id };
  }

  async approve(actionId: string, approver: string): Promise<ApproveResult> {
    const action = await this.actions.findAction(actionId);
    if (!action) throw new ActionNotFoundError(actionId);
    if (action.status !== 'pending') throw new ActionNotPendingError(actionId);
    if (action.proposed_by === approver) throw new SoDViolationError('approver must differ from proposer'); // D36
    const claimed = await this.actions.decide(actionId, 'approved', approver);
    if (!claimed) throw new ActionNotPendingError(actionId); // lost a concurrent race

    await this.audit.record({
      actor: approver,
      action: `action.approve.${action.kind}`,
      subject: action.market_id,
      before: { proposedBy: action.proposed_by },
      after: { actionId },
    });
    // Execute AFTER the claim, durably: the override runs in a job that marks it 'executed' only on success (D45b).
    await this.jobs.send(EXECUTE_OVERRIDE, { actionId }, { singletonKey: actionId });
    return { kind: action.kind, actionId };
  }

  /**
   * Run an approved override, then mark it executed (D45b) — never before. Idempotent and retry-safe:
   * void/resettle are no-ops once applied, and a re-delivery finds the action already 'executed' and returns.
   */
  async executeOverride(actionId: string): Promise<void> {
    const action = await this.actions.findAction(actionId);
    if (!action || action.status !== 'approved') return;
    const params = action.params as ProposalParams;
    const actor = action.approved_by ?? 'system';
    if (action.kind === 'void') await this.settlement.voidMarket(action.market_id, actor, params.reason);
    else await this.settlement.resettleFancyMarket(action.market_id, actor, params.reason, params.correctionId ?? actionId);
    await this.actions.markExecuted(actionId);
  }

  async reject(actionId: string, operator: string, reason: string): Promise<void> {
    const action = await this.actions.findAction(actionId);
    if (!action) throw new ActionNotFoundError(actionId);
    if (action.status !== 'pending') throw new ActionNotPendingError(actionId);
    const claimed = await this.actions.decide(actionId, 'rejected', operator);
    if (!claimed) throw new ActionNotPendingError(actionId);
    await this.audit.record({ actor: operator, action: `action.reject.${action.kind}`, subject: action.market_id, reason });
  }

  // ---- read-only risk views (XC5.1) -----------------------------------------

  exposureByMarket(marketId: string): Promise<Chips> {
    return this.placement.operatorLiability(marketId);
  }
  exposureByMatch(matchId: string): Promise<Chips> {
    return this.placement.operatorLiabilityByMatch(matchId);
  }
  exposureByUser(userId: string, marketId: string): Promise<Chips> {
    return this.placement.customerExposure(userId, marketId);
  }

  async integrityFlags(marketId: string): Promise<IntegrityFlag[]> {
    const stakes = await this.placement.stakesByUserForMarket(marketId);
    return flagConcentration(stakes.map((s) => ({ userId: s.userId, stake: s.stake as bigint })), FLAG_MAX);
  }
}
