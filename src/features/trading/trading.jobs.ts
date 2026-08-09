import { Injectable } from '@nestjs/common';
import { JobQueue } from '../../jobs';
import { EXECUTE_OVERRIDE, TradingService } from './trading.service';

/** Registers the four-eyes override executor on the durable queue (D45b); approve() enqueues it. */
@Injectable()
export class TradingJobs {
  constructor(jobs: JobQueue, trading: TradingService) {
    jobs.register(EXECUTE_OVERRIDE, async (d) => {
      await trading.executeOverride(String(d.actionId));
    });
    jobs.onReady(() => trading.redriveApprovedOverrides()); // L1: recover approvals whose execute-job never persisted
  }
}
