import { z } from 'zod';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export const outfitChatSchema = z.object({
  profileId: z.string().optional(),
  question: z.string().min(1).max(300),
  /** Prior turns in this conversation, oldest first — omitted/empty for the first question. */
  history: z.array(chatMessageSchema).max(20).optional(),
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
