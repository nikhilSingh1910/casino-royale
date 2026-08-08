import { randomUUID } from 'node:crypto';
import { ConfigService } from '../shared/config';
import { JobQueue } from './job-queue.service';

const TEST_URL = 'postgres://localhost:5432/casino_royale_test';
const cfg = (jobsEnabled: boolean): ConfigService =>
  ({
    get: (k: string) =>
      ({ DATABASE_URL: TEST_URL, JOBS_ENABLED: jobsEnabled, LOG_LEVEL: 'silent', NODE_ENV: 'test', PORT: 3000 } as Record<string, unknown>)[k],
  }) as unknown as ConfigService;

describe('JobQueue (integration, real Postgres) — D45', () => {
  it('runs the handler inline when the worker is off — deterministic (tests/dev)', async () => {
    const q = new JobQueue(cfg(false));
    let got: Record<string, unknown> | null = null;
    q.register('inline-q', async (d) => {
      got = d;
    });
    await q.onModuleInit(); // no worker started
    await q.send('inline-q', { a: 1 });
    expect(got).toEqual({ a: 1 });
    await q.onModuleDestroy();
  });

  it('drains a sent job through a real pg-boss worker when enabled', async () => {
    const q = new JobQueue(cfg(true));
    const queue = `durable-${randomUUID()}`; // fresh queue per run — avoids stale singleton state across runs
    let resolve!: () => void;
    const done = new Promise<void>((r) => {
      resolve = r;
    });
    let got: Record<string, unknown> | null = null;
    q.register(queue, async (d) => {
      got = d;
      resolve();
    });
    await q.onModuleInit(); // starts pg-boss + the worker
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await q.send(queue, { b: 2 }, { singletonKey: randomUUID() });
      const timeout = new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error('job not drained in time')), 15000);
      });
      await Promise.race([done, timeout]);
      expect(got).toEqual({ b: 2 });
    } finally {
      if (timer) clearTimeout(timer);
      await q.onModuleDestroy();
    }
  }, 25000);
});
