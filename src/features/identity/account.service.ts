import { Injectable } from '@nestjs/common';
import { chips, Chips } from '../../shared/money';
import { LedgerService, StatementRow } from '../../ledger';
import { IdentityRepo } from './identity.repo';

export class NotEligibleError extends Error {}

const STATEMENT_MAX = 200;
const DAILY_BONUS = chips(50000n); // €500 of play chips, minted through the ledger once per UTC day (PC2)

/** The idempotency key that makes the daily bonus claimable exactly once per UTC day — pure (§3.12). */
export function bonusKey(userId: string, at: Date): string {
  return `bonus:${userId}:${at.toISOString().slice(0, 10)}`;
}
/** The next UTC midnight after `at` — when the bonus can be claimed again. Pure. */
export function nextDailyReset(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1));
}

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

  /** The daily bonus amount — one source of truth for both the mint and its display (§3.2 / N4). */
  dailyBonus(): Chips {
    return DAILY_BONUS;
  }

  /** The account statement — chip movements, newest first, bounded (CLAUDE.md §3.3). */
  async statement(userId: string, limit: number): Promise<StatementRow[]> {
    const bounded = Math.max(1, Math.min(limit, STATEMENT_MAX));
    return this.ledger.statement(userId, bounded);
  }

  /**
   * Grant the daily play-chip bonus — minted through the ledger, idempotent per UTC day (PC2). A second
   * claim the same day is a no-op (`claimed=false`) via the ledger's key dedupe; no new chip path (§5.1).
   */
  async claimDailyBonus(userId: string): Promise<{ claimed: boolean; available: Chips; reserved: Chips; nextClaimAt: Date }> {
    const u = await this.repo.findById(userId);
    if (!u || u.status !== 'active') throw new NotEligibleError('account not active'); // fail closed (§4)
    const now = new Date();
    const op = await this.ledger.topUp(userId, DAILY_BONUS, bonusKey(userId, now), 'bonus');
    const bal = await this.ledger.balance(userId);
    return { claimed: !op.replayed, available: bal.available, reserved: bal.reserved, nextClaimAt: nextDailyReset(now) };
  }

  /** The one gate (M2/B4.1): ACTIVE account with chips to stake. No KYC/deposit gates (D32). */
  async assertCanBet(userId: string): Promise<void> {
    const u = await this.repo.findById(userId);
    if (!u || u.status !== 'active') throw new NotEligibleError('account not active');
    const bal = await this.ledger.balance(userId);
    if ((bal.available as bigint) <= 0n) throw new NotEligibleError('no chips available');
  }
}
