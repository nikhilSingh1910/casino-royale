import { z } from 'zod';

export const FEED_SOURCES = ['fixture', 'cricbuzz'] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

/** The shape of the environment. Parsed once, at boot (CLAUDE.md §3.11). */
export const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Used from M1 onward (the chip ledger + all state). Required so a missing DB fails at boot.
    DATABASE_URL: z.string().url(),
    // Which cricket feed to run (CM1/XC1.8).
    FEED_SOURCE: z.enum(FEED_SOURCES).default('fixture'),
    // Demo live ticker: ms between generated balls. 0 = off (default, and always off in tests).
    LIVE_TICK_MS: z.coerce.number().int().nonnegative().default(0),
  })
  .superRefine((cfg, ctx) => {
    // `fixture` is fake recorded data — never serve it as the live feed in production (D26; under
    // D32 the real-money bar is moot, but "don't show fake matches in prod" still holds).
    if (cfg.NODE_ENV === 'production' && cfg.FEED_SOURCE === 'fixture') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FEED_SOURCE'],
        message: "FEED_SOURCE 'fixture' is fake data and is not allowed in production.",
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
