import { Injectable } from '@nestjs/common';
import { JobQueue } from '../../jobs';
import { SettlementService } from './settlement.service';

export const SETTLE_DUE = 'settle-due';

/** Registers cricket settlement handlers on the durable queue (D45); the live ticker enqueues them. */
@Injectable()
export class CricketJobs {
  constructor(jobs: JobQueue, settlement: SettlementService) {
    jobs.register(SETTLE_DUE, async (d) => {
      await settlement.settleDueMarkets(String(d.matchId));
    });
  }
}
