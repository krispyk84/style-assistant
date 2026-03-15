import { z } from 'zod';

const outfitTierSchema = z.enum(['business', 'smart-casual', 'casual']);

export const generateOutfitsSchema = z.object({
  requestId: z.string().min(1),
  profileId: z.string().optional(),
  anchorItemDescription: z.string().default(''),
  anchorImageId: z.string().optional(),
  anchorImageUrl: z.string().url().optional(),
  photoPending: z.boolean(),
  selectedTiers: z.array(outfitTierSchema).min(1),
}).superRefine((value, ctx) => {
  if (!value.anchorItemDescription.trim() && !value.anchorImageId && !value.anchorImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['anchorItemDescription'],
      message: 'Provide an anchor item description or image.',
    });
  }
});

export const regenerateTierSchema = z.object({
  tier: outfitTierSchema,
});
