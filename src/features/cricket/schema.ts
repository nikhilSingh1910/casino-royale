import { z } from 'zod';

// Money crosses the wire as integer-minor-unit strings (never a JS number) — parsed to bigint at the edge.
// Positive only: a 0/negative stake or price is a 400 here, not a 500 from the ledger's positivity guard.
const posIntStr = z.string().regex(/^[1-9]\d*$/, 'must be a positive integer string');

export const placeBetDto = z.object({
  marketId: z.string().uuid(),
  side: z.enum(['back', 'lay']),
  stake: posIntStr,
  seenLineValue: z.number().int().nonnegative(),
  seenPrice: posIntStr,
  idempotencyKey: z.string().uuid(),
});

export const placeRunnerBetDto = z.object({
  marketId: z.string().uuid(),
  runnerId: z.string().uuid(),
  side: z.enum(['back', 'lay']),
  stake: posIntStr,
  seenPrice: posIntStr,
  idempotencyKey: z.string().uuid(),
});

export type PlaceBetDto = z.infer<typeof placeBetDto>;
export type PlaceRunnerBetDto = z.infer<typeof placeRunnerBetDto>;
