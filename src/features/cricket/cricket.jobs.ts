import { Injectable } from '@nestjs/common';
import { JobQueue } from '../../jobs';
import { SettlementService } from './settlement.service';

export const SETTLE_DUE = 'settle-due';
export const SETTLE_BALL = 'settle-ball';
export const SETTLE_MATCH = 'settle-match';

/** Registers cricket settlement handlers on the durable queue (D45/D46); the live ticker enqueues them. */
@Injectable()
export class CricketJobs {
  constructor(jobs: JobQueue, settlement: SettlementService) {
    jobs.register(SETTLE_DUE, async (d) => {
      await settlement.settleDueMarkets(String(d.matchId));
    });
    jobs.register(SETTLE_BALL, async (d) => {
      await settlement.settleBall(String(d.marketId), String(d.outcome));
    });
    jobs.register(SETTLE_MATCH, async (d) => {
      await settlement.settleMatch(String(d.matchId), String(d.winner));
    });
  }
}
