import { Injectable } from '@nestjs/common';
import { BetRepo } from './bet.repo';

const LEADERBOARD_MAX = 100;

/** A stable, non-PII display handle for a player — derived from the id, never the email (§11.11 GDPR). */
export function handle(userId: string): string {
  return `Player ${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  pnl: bigint;
  you: boolean;
}

/** The engagement leaderboard (PC5): players ranked by settled net P&L, reading via BetRepo. */
@Injectable()
export class LeaderboardService {
  constructor(private readonly bets: BetRepo) {}

  async top(limit: number, currentUserId: string): Promise<LeaderboardEntry[]> {
    const rows = await this.bets.leaderboard(Math.max(1, Math.min(limit, LEADERBOARD_MAX)));
    return rows.map((r, i) => ({ rank: i + 1, handle: handle(r.userId), pnl: r.pnl, you: r.userId === currentUserId }));
  }
}
