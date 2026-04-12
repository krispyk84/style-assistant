import { z } from 'zod';

export const upsertProfileSchema = z.object({
  name: z.string().max(100).default(''),
  gender: z.string().min(1),
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
  fitPreference: z.string().min(1),
  stylePreference: z.string().min(1),
  budget: z.string().min(1),
  hairColor: z.string().min(1),
  skinTone: z.string().min(1),
  summerBottomPreference: z.string().min(1),
  temperatureUnit: z.string().min(1),
  bodyType: z.string().optional(),
  notes: z.string().max(240).optional(),
  onboardingCompleted: z.boolean(),
});
