import { z } from 'zod';

import { haircutGuideResponseSchema } from './haircut.schemas.js';

export const createHaircutSessionSchema = z.object({
  headshotImageUrl: z.string().url(),
});
export type CreateHaircutSessionPayload = z.infer<typeof createHaircutSessionSchema>;

export const generateHaircutAngleShotsSchema = z.object({
  optionId: z.string().min(1),
});
export type GenerateHaircutAngleShotsPayload = z.infer<typeof generateHaircutAngleShotsSchema>;

export const generateHaircutGuideSchema = z.object({
  styleLabel: z.string().min(1),
  styleSummary: z.string().min(1),
});
export type GenerateHaircutGuidePayload = z.infer<typeof generateHaircutGuideSchema>;

export const saveHaircutSessionSchema = z.object({
  optionId: z.string().min(1),
  guide: haircutGuideResponseSchema,
});
export type SaveHaircutSessionPayload = z.infer<typeof saveHaircutSessionSchema>;
