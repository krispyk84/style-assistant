import { z } from 'zod';

export const upsertProfileSchema = z.object({
  gender: z.string().min(1),
  heightCm: z.number().int().positive(),
  weightKg: z.number().int().positive(),
  fitPreference: z.string().min(1),
  stylePreference: z.string().min(1),
  budget: z.string().min(1),
  hairColor: z.string().min(1),
  skinTone: z.string().min(1),
  summerBottomPreference: z.string().min(1),
  notes: z.string().max(240).optional(),
  onboardingCompleted: z.boolean(),
});
