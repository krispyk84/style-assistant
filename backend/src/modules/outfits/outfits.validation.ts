import { z } from 'zod';

const outfitTierSchema = z.enum(['business', 'smart-casual', 'casual']);

export const generateOutfitsSchema = z.object({
  requestId: z.string().min(1),
  profileId: z.string().optional(),
  anchorItems: z
    .array(
      z.object({
        description: z.string().default(''),
        imageId: z.string().optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .max(5)
    .optional(),
  anchorItemDescription: z.string().default(''),
  vibeKeywords: z.string().trim().max(160).optional(),
  anchorImageId: z.string().optional(),
  anchorImageUrl: z.string().url().optional(),
  photoPending: z.boolean(),
  selectedTiers: z.array(outfitTierSchema).min(1),
  generateOnlyTier: outfitTierSchema.optional(),
  weatherContext: z
    .object({
      temperatureC: z.number(),
      apparentTemperatureC: z.number(),
      weatherCode: z.number(),
      season: z.enum(['winter', 'spring', 'summer', 'fall']),
      summary: z.string().min(1),
      stylingHint: z.string().min(1),
      locationLabel: z.string().nullable(),
      fetchedAt: z.string().min(1),
    })
    .nullable()
    .optional(),
  manualSeason: z.enum(['winter', 'spring', 'summer', 'fall']).nullable().optional(),
  includeBag: z.boolean().optional(),
  includeHat: z.boolean().optional(),
  additionalDetails: z.string().trim().max(500).optional(),
  variantContext: z
    .object({
      index: z.number().int().min(1).max(3),
      total: z.number().int().min(1).max(3),
      previousVariations: z
        .array(
          z.object({
            title: z.string().min(1),
            stylingDirection: z.string().min(1),
            keyPieces: z.array(z.string()).default([]),
            shoes: z.array(z.string()).default([]),
            accessories: z.array(z.string()).default([]),
          }),
        )
        .optional(),
    })
    .optional(),
  trendiness: z.number().min(0).max(100).optional(),
}).superRefine((value, ctx) => {
  const hasAnchorItems = Boolean(
    value.anchorItems?.some((item) => item.description.trim() || item.imageId || item.imageUrl)
  );

  if (!hasAnchorItems && !value.anchorItemDescription.trim() && !value.anchorImageId && !value.anchorImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['anchorItems'],
      message: 'Provide an anchor item description or image.',
    });
  }
});

export const regenerateTierSchema = z.object({
  tier: outfitTierSchema,
});
