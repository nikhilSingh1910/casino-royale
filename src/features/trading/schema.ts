import { z } from 'zod';

export const proposeDto = z
  .object({
    kind: z.enum(['void', 'resettle']),
    marketId: z.string().uuid(),
    reason: z.string().min(1).max(500),
    correctionId: z.string().min(1).max(100).optional(),
  })
  .refine((d) => d.kind !== 'resettle' || !!d.correctionId, { message: 'resettle requires a correctionId' });

export const rejectDto = z.object({ reason: z.string().min(1).max(500) });

/** Declare a real match's result (PC3): proposes a four-eyes settle_match action. */
export const declareResultDto = z.object({ winner: z.string().min(1).max(100), reason: z.string().min(1).max(500) });

export type ProposeDto = z.infer<typeof proposeDto>;
export type RejectDto = z.infer<typeof rejectDto>;
export type DeclareResultDto = z.infer<typeof declareResultDto>;
