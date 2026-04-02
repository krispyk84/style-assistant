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

export const closetMatchSchema = z.object({
  suggestions: z.array(z.string().min(1)).min(1).max(30),
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
});

export type AnalyzeClosetItemPayload = z.infer<typeof analyzeClosetItemSchema>;
export type SaveClosetItemPayload = z.infer<typeof saveClosetItemSchema>;
export type UpdateClosetItemPayload = z.infer<typeof updateClosetItemSchema>;
export type GenerateClosetSketchPayload = z.infer<typeof generateClosetSketchSchema>;
export type ClosetMatchPayload = z.infer<typeof closetMatchSchema>;
