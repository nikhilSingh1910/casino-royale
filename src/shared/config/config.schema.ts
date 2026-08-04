import { z } from 'zod';

/** The shape of the environment. Parsed once, at boot (CLAUDE.md §3.11). */
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Used from M1 onward (the chip ledger + all state). Required so a missing DB fails at boot.
  DATABASE_URL: z.string().url(),
});

export type AppConfig = z.infer<typeof configSchema>;
