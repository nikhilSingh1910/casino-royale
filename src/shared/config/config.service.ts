import { Injectable } from '@nestjs/common';
import { AppConfig, configSchema } from './config.schema';

/**
 * The one and only reader of process.env (CLAUDE.md §3.11, M0/C2.1).
 * A missing or malformed key throws here, on boot — never three hours into a job.
 */
@Injectable()
export class ConfigService {
  readonly values: AppConfig;

  constructor() {
    const parsed = configSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    this.values = parsed.data;
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.values[key];
  }
}
