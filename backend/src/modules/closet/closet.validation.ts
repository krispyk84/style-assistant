import { z } from 'zod';

export const analyzeClosetItemSchema = z.object({
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  description: z.string().optional(),
});

export const saveClosetItemSchema = z.object({
  title: z.string().min(1),
  brand: z.string().default(''),
  size: z.string().default(''),
  category: z.string().default('Clothing'),
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  sketchImageUrl: z.string().optional(),
});

export const updateClosetItemSchema = z.object({
  title: z.string().min(1),
  brand: z.string().default(''),
  size: z.string().default(''),
  category: z.string().default('Clothing'),
});

export const generateClosetSketchSchema = z.object({
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().url(),
});

const outfitPieceInputSchema = z.object({
  display_name: z.string().min(1),
  category: z.string().optional(),
  color: z.string().optional(),
  formality: z.string().optional(),
});

export const closetMatchSchema = z.object({
  suggestions: z.array(outfitPieceInputSchema).min(1).max(30),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        category: z.string(),
        brand: z.string().optional(),
      })
    )
    .max(100),
  /** 0 = most forgiving, 100 = most precise. Default: 50. */
  sensitivity: z.number().min(0).max(100).optional(),
  /** Item IDs to exclude — used when regenerating a specific slot after thumbs-down. */
  excludeItemIds: z.array(z.string()).optional(),
});

export type AnalyzeClosetItemPayload = z.infer<typeof analyzeClosetItemSchema>;
export type SaveClosetItemPayload = z.infer<typeof saveClosetItemSchema>;
export type UpdateClosetItemPayload = z.infer<typeof updateClosetItemSchema>;
export type GenerateClosetSketchPayload = z.infer<typeof generateClosetSketchSchema>;
export type ClosetMatchPayload = z.infer<typeof closetMatchSchema>;
