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

// Sync redesign, Phase 1A: version-aware request shapes, additive
// alongside the legacy schemas above.
export const createClosetOutfitFavouriteSchema = upsertClosetOutfitFavouriteSchema;

export const updateClosetOutfitFavouriteVersionedSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  formality: z.string().min(1),
  outfit: z.unknown(),
  savedAt: z.string().min(1),
});

export const deleteVersionedQuerySchema = z.object({
  baseVersion: z.coerce.number().int().nonnegative(),
});

export const createClosetOutfitWeekPlanItemSchema = upsertClosetOutfitWeekPlanItemSchema;

export const updateClosetOutfitWeekPlanItemVersionedSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  dayLabel: z.string().min(1),
  formality: z.string().min(1),
  outfit: z.unknown(),
  assignedAt: z.string().min(1),
});
