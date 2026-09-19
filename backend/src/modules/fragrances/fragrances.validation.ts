import { z } from 'zod';

export const searchFragrancesSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export const profileFragranceSchema = z
  .object({
    brand: z.string().trim().max(120).optional(),
    name: z.string().trim().max(160).optional(),
    concentration: z.string().trim().max(60).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((data) => Boolean(data.imageUrl) || Boolean(data.brand?.trim() && data.name?.trim()), {
    message: 'Provide an imageUrl, or both brand and name.',
  });

export const fragranceSketchPreviewSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  concentration: z.string().trim().max(60).optional(),
  imageUrl: z.string().url().optional(),
});

export const addUserFragranceSchema = z.object({
  fragranceId: z.string().min(1),
  originalImageUrl: z.string().url().optional(),
  bottleSketchUrl: z.string().url().optional(),
  isSignature: z.boolean().optional(),
  currentVolumeMl: z.number().min(0).nullable().optional(),
  userNotes: z.string().trim().max(500).optional(),
  // User-edited-before-first-save corrections (spec section 12/18) — field-by-field
  // override of the catalog row, never a mutation of it. Same shape as updateUserFragranceSchema's.
  profileOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const createManualFragranceSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  concentration: z.string().trim().max(60).optional(),
  primaryVibe: z.string().trim().max(60).optional(),
  secondaryVibes: z.array(z.string().trim().max(60)).max(6).optional(),
  seasonality: z.record(z.string(), z.number()).optional(),
  formality: z.record(z.string(), z.number()).optional(),
});

export const updateUserFragranceSchema = z.object({
  isSignature: z.boolean().optional(),
  currentVolumeMl: z.number().min(0).nullable().optional(),
  userNotes: z.string().trim().max(500).optional(),
  profileOverrides: z.record(z.string(), z.unknown()).optional(),
});

export type SearchFragrancesPayload = z.infer<typeof searchFragrancesSchema>;
export type ProfileFragrancePayload = z.infer<typeof profileFragranceSchema>;
export type FragranceSketchPreviewPayload = z.infer<typeof fragranceSketchPreviewSchema>;
export type AddUserFragrancePayload = z.infer<typeof addUserFragranceSchema>;
export type UpdateUserFragrancePayload = z.infer<typeof updateUserFragranceSchema>;
export type CreateManualFragrancePayload = z.infer<typeof createManualFragranceSchema>;
