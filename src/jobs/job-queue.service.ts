import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { ConfigService } from '../shared/config';

export type JobHandler = (data: Record<string, unknown>) => Promise<void>;

/**
 * The one durable-work boundary (D45, CLAUDE.md §4). Providers `register` a queue's handler in their
 * constructor and enqueue with `send`. When the worker is off (tests/dev, `JOBS_ENABLED=false`) `send`
 * runs the handler inline so behaviour is identical and deterministic; when on, it is a persisted,
 * retried, per-key-singleton pg-boss job drained by a worker.
 */
@Injectable()
export class JobQueue implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('jobs');
  private readonly handlers = new Map<string, JobHandler>();
  private readonly recoveries: Array<() => Promise<void>> = [];
  private boss?: PgBoss;

  constructor(private readonly config: ConfigService) {}

  /** Register a queue's handler. Call from a provider constructor — before onModuleInit wires the worker. */
  register(queue: string, handler: JobHandler): void {
    this.handlers.set(queue, handler);
  }

  /** Register a post-start reconciliation, run once after the worker is up — re-drives durably-recorded work (L1). */
  onReady(recover: () => Promise<void>): void {
    this.recoveries.push(recover);
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get('JOBS_ENABLED') !== true) return; // off → send() runs handlers inline
    const boss = new PgBoss(this.config.get('DATABASE_URL'));
    boss.on('error', (e) => this.log.error(e instanceof Error ? e.message : String(e)));
    await boss.start();
    for (const [queue, handler] of this.handlers) {
      await boss.work<Record<string, unknown>>(queue, (job) => handler(job.data));
    }
    this.boss = boss;
    this.log.log(`job queue on — ${this.handlers.size} worker(s)`);
    // Reconcile durably-recorded work once the worker is up (L1). A recovery hiccup logs, never aborts boot — the next start retries.
    for (const recover of this.recoveries) {
      try {
        await recover();
      } catch (e) {
        this.log.error(`recovery failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop({ graceful: false, destroy: true });
  }

  /** Enqueue a job (or run it inline when the worker is off). `singletonKey` serialises jobs per key. */
  async send(queue: string, data: Record<string, unknown>, opts?: { singletonKey?: string }): Promise<void> {
    if (this.boss) {
      await this.boss.send(queue, data, opts?.singletonKey ? { singletonKey: opts.singletonKey } : {});
      return;
    }
    const handler = this.handlers.get(queue);
    if (handler) await handler(data);
  }
}
