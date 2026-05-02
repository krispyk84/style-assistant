import { z } from 'zod';

// ── Anchor sketch description (vision → structured) ──────────────────────────
// Used by anchor-description.service to extract a structural description, drift
// suppression terms, and color metadata from the uploaded anchor image.

const anchorColorSwatchSchema = z.object({
  hex: z.string(),
  name: z.string(),
  placement: z.string(),
});

const anchorColorMetadataSchema = z.object({
  dominantColorHex: z.string(),
  dominantColorName: z.string(),
  lightnessTone: z.enum(['very light', 'light', 'medium', 'dark', 'very dark']),
  temperatureTone: z.enum(['warm', 'neutral', 'cool']),
  isMultiColor: z.boolean(),
  secondaryColors: z.array(anchorColorSwatchSchema),
  colorPattern: z.string().nullable(),
});

export const anchorSketchDescriptionSchema = z.object({
  description: z.string(),
  antiDrift: z.string(),
  colorMetadata: anchorColorMetadataSchema,
});
