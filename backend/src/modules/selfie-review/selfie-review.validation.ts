import { z } from 'zod';

export const selfieReviewSchema = z.object({
  profileId: z.string().optional(),
  imageId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageFilename: z.string().optional(),
  requestId: z.string().optional(),
  tier: z.string().optional(),
  outfitTitle: z.string().optional(),
  anchorItemDescription: z.string().optional(),
});
