import { z } from 'zod';

export const upsertClosetOutfitFavouriteSchema = z.object({
  id: z.string().min(1),
  formality: z.string().min(1),
  outfit: z.unknown(),
  savedAt: z.string().min(1),
});

export const upsertClosetOutfitWeekPlanItemSchema = z.object({
  dayKey: z.string().min(1),
  dayLabel: z.string().min(1),
  formality: z.string().min(1),
  outfit: z.unknown(),
  assignedAt: z.string().min(1),
});
