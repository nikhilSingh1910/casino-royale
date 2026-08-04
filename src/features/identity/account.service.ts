import { Injectable } from '@nestjs/common';
import { Chips } from '../../shared/money';
import { LedgerService, StatementRow } from '../../ledger';
import { IdentityRepo } from './identity.repo';

export class NotEligibleError extends Error {}

const STATEMENT_MAX = 200;

@Injectable()
export class AccountService {
  constructor(
    private readonly repo: IdentityRepo,
    private readonly ledger: LedgerService,
  ) {}

  async me(userId: string) {
    const u = await this.repo.findById(userId);
    if (!u) throw new NotEligibleError('account not found');
    return { id: u.id, email: u.email, status: u.status, role: u.role };
  }

  async balance(userId: string): Promise<{ available: Chips; reserved: Chips }> {
    return this.ledger.balance(userId);
  }

  /** The account statement — chip movements, newest first, bounded (CLAUDE.md §3.3). */
  async statement(userId: string, limit: number): Promise<StatementRow[]> {
    const bounded = Math.max(1, Math.min(limit, STATEMENT_MAX));
    return this.ledger.statement(userId, bounded);
  }

  /** The one gate (M2/B4.1): ACTIVE account with chips to stake. No KYC/deposit gates (D32). */
  async assertCanBet(userId: string): Promise<void> {
    const u = await this.repo.findById(userId);
    if (!u || u.status !== 'active') throw new NotEligibleError('account not active');
    const bal = await this.ledger.balance(userId);
    if ((bal.available as bigint) <= 0n) throw new NotEligibleError('no chips available');
  }
}
