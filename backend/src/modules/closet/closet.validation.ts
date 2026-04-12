import { z } from 'zod';

export const analyzeClosetItemSchema = z.object({
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  sketchImageUrl: z.string().optional(),
  description: z.string().optional(),
});

const closetMetadataFields = {
  subcategory: z.string().optional(),
  primaryColor: z.string().optional(),
  colorFamily: z.string().optional(),
  material: z.string().optional(),
  formality: z.string().optional(),
  silhouette: z.string().optional(),
  season: z.string().optional(),
  weight: z.string().optional(),
  pattern: z.string().optional(),
  notes: z.string().optional(),
  fitStatus: z.string().optional(),
  lensShape: z.string().optional(),
  frameColor: z.string().optional(),
};

export const saveClosetItemSchema = z.object({
  title: z.string().min(1),
  brand: z.string().default(''),
  size: z.string().default(''),
  category: z.string().default('Clothing'),
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  sketchImageUrl: z.string().optional(),
  ...closetMetadataFields,
});

export const updateClosetItemSchema = z.object({
  title: z.string().min(1),
  brand: z.string().default(''),
  size: z.string().default(''),
  category: z.string().default('Clothing'),
  ...closetMetadataFields,
});

export const generateClosetSketchSchema = z.object({
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().url(),
  title: z.string().optional(),
  category: z.string().optional(),
  lensShape: z.string().optional(),
  frameColor: z.string().optional(),
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
        colorFamily: z.string().optional(),
        material: z.string().optional(),
        formality: z.string().optional(),
        lensShape: z.string().optional(),
      })
    )
    .max(100),
  /** 0 = most forgiving, 100 = most precise. Default: 50. */
  sensitivity: z.number().min(0).max(100).optional(),
  /** Item IDs to exclude — used when regenerating a specific slot after thumbs-down. */
  excludeItemIds: z.array(z.string()).optional(),
});

export const helpMePickSchema = z.object({
  stylistId: z.enum(['vittorio', 'alessandra']),
  dayType: z.string().min(1),
  vibe: z.string().min(1),
  risk: z.string().min(1),
  rejectedIds: z.array(z.string()).optional(),
});

export type StylistId = 'vittorio' | 'alessandra';
export type AnalyzeClosetItemPayload = z.infer<typeof analyzeClosetItemSchema>;
export type SaveClosetItemPayload = z.infer<typeof saveClosetItemSchema>;
export type UpdateClosetItemPayload = z.infer<typeof updateClosetItemSchema>;
export type GenerateClosetSketchPayload = z.infer<typeof generateClosetSketchSchema>;
export type GenerateClosetSketchOptions = Pick<GenerateClosetSketchPayload, 'title' | 'category' | 'lensShape' | 'frameColor'>;
export type ClosetMatchPayload = z.infer<typeof closetMatchSchema>;
export type HelpMePickPayload = z.infer<typeof helpMePickSchema>;
