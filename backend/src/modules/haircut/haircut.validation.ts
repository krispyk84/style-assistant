import { z } from 'zod';

export const createHaircutSessionSchema = z.object({
  headshotImageUrl: z.string().url(),
});
export type CreateHaircutSessionPayload = z.infer<typeof createHaircutSessionSchema>;

export const generateHaircutGuideSchema = z.object({
  styleLabel: z.string().min(1),
  styleSummary: z.string().min(1),
});
export type GenerateHaircutGuidePayload = z.infer<typeof generateHaircutGuideSchema>;
