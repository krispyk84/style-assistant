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
