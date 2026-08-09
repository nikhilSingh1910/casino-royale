import { Injectable } from '@nestjs/common';
import { BetStatus } from '../../db';
import { BetRepo } from './bet.repo';

const HISTORY_MAX = 200;

/** A settled bet's P&L, derived from its outcome — never stored (§3.10). Open bets are pending (null). */
export function betPnl(status: BetStatus, reserved: bigint, potentialPayout: bigint): bigint | null {
  if (status === 'won') return potentialPayout; // profit = winnings paid
  if (status === 'lost') return -reserved; // the reserved stake/liability is lost
  if (status === 'void') return 0n;
  return null; // open — not yet resolved
}

export interface BetHistoryItem {
  id: string;
  placedAt: Date;
  match: string;
  market: string;
  marketType: string;
  selection: string;
  side: string;
  stake: bigint;
  price: bigint;
  status: BetStatus;
  pnl: bigint | null;
}

/** A user's bet history for the account view (PC1) — reads via BetRepo, derives P&L, shapes for display. */
@Injectable()
export class BetHistoryService {
  constructor(private readonly bets: BetRepo) {}

  async forUser(userId: string, limit: number): Promise<BetHistoryItem[]> {
    const rows = await this.bets.betsForUser(userId, Math.max(1, Math.min(limit, HISTORY_MAX)));
    return rows.map((r) => ({
      id: r.id,
      placedAt: r.placedAt,
      match: r.matchName,
      market: r.marketName,
      marketType: r.marketType,
      selection: r.runnerName ?? (r.lineValue !== null ? `Line ${r.lineValue}` : '—'),
      side: r.side,
      stake: r.stake,
      price: r.price,
      status: r.status,
      pnl: betPnl(r.status, r.reserved, r.potentialPayout),
    }));
  }
}
