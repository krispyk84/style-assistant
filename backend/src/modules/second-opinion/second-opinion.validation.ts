import { z } from 'zod';

export const secondOpinionSchema = z.object({
  stylistId: z.enum(['vittorio', 'alessandra']),
  profileId: z.string().optional(),
  outfitTitle: z.string().optional(),
  tier: z.string().optional(),
  anchorItem: z.string().optional(),
  keyPieces: z.array(z.string()).optional(),
  shoes: z.array(z.string()).optional(),
  accessories: z.array(z.string()).optional(),
  fitNotes: z.array(z.string()).optional(),
  whyItWorks: z.string().optional(),
  stylingDirection: z.string().optional(),
});
