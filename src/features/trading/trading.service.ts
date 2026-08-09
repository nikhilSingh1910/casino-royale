import { Injectable } from '@nestjs/common';
import { Chips } from '../../shared/money';
import { OperatorActionKind } from '../../db';
import { AuditService } from '../audit';
import { MarketService, MatchResultError, PlacementService, SettlementService } from '../cricket';
import { JobQueue } from '../../jobs';
import { ActionNotFoundError, ActionNotPendingError, SoDViolationError } from './errors';
import { flagConcentration, IntegrityFlag } from './integrity';
import { TradingRepo } from './trading.repo';

export interface ProposalParams {
  reason: string;
  correctionId?: string;
  winner?: string; // settle_match: the declared winning runner name (PC3)
}
export type ApproveResult = { kind: OperatorActionKind; actionId: string };

/** Durable queue name for executing an approved four-eyes override (D45b). */
export const EXECUTE_OVERRIDE = 'execute-override';

const FLAG_MAX = 1000;
const REDRIVE_MAX = 500;

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

  /**
   * Propose a declared match result (four-eyes settle_match, PC3): validate the winner is a runner, anchor
   * the action to the match-odds market, and store the winner for the approver to execute. Real matches
   * settle this way; the demo ticker auto-settles generated ones.
   */
  async proposeMatchResult(matchId: string, winner: string, reason: string, adjuster: string): Promise<{ id: string }> {
    const view = await this.markets.getMatchView(matchId);
    const mo = view?.markets.find((m) => m.type === 'match_odds');
    if (!mo) throw new MatchResultError(`no match-odds market for match ${matchId}`);
    if (!mo.runners.some((r) => r.name === winner)) throw new MatchResultError(`'${winner}' is not a runner in match ${matchId}`);
    const { id } = await this.actions.createAction('settle_match', mo.id, { reason, winner }, adjuster);
    await this.audit.record({ actor: adjuster, action: 'action.propose.settle_match', subject: matchId, after: { actionId: id, winner } });
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
    else if (action.kind === 'settle_match') {
      const m = await this.markets.getMarket(action.market_id); // the anchor match-odds market → its match
      if (m?.match_id && params.winner) await this.settlement.settleMatch(m.match_id, params.winner, actor);
    } else await this.settlement.resettleFancyMarket(action.market_id, actor, params.reason, params.correctionId ?? actionId);
    await this.actions.markExecuted(actionId);
  }

  /**
   * Startup reconciliation (L1): re-enqueue overrides claimed 'approved' whose execute-job may have failed to
   * persist after the claim. Idempotent — singletonKey dedupes a live job and executeOverride no-ops once applied.
   */
  async redriveApprovedOverrides(): Promise<void> {
    const stuck = await this.actions.approvedUnexecuted(REDRIVE_MAX);
    await Promise.all(stuck.map((a) => this.jobs.send(EXECUTE_OVERRIDE, { actionId: a.id }, { singletonKey: a.id })));
  }

  async reject(actionId: string, operator: string, reason: string): Promise<void> {
    const action = await this.actions.findAction(actionId);
    if (!action) throw new ActionNotFoundError(actionId);
    if (action.status !== 'pending') throw new ActionNotPendingError(actionId);
    const claimed = await this.actions.decide(actionId, 'rejected', operator);
    if (!claimed) throw new ActionNotPendingError(actionId);
    await this.audit.record({
      actor: operator,
      action: `action.reject.${action.kind}`,
      subject: action.market_id,
      before: { status: 'pending', proposedBy: action.proposed_by },
      after: { status: 'rejected' },
      reason,
    });
  }

  // ---- operator console reads (PC3b) ----------------------------------------

  pendingActions(limit: number) {
    return this.actions.pending(limit);
  }
  recentAudit(limit: number) {
    return this.audit.recent(limit);
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
