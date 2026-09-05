import { z } from 'zod';

// ~2-4 short sentences — a direct, specific answer, not an essay.
const ANSWER_MAX_LENGTH = 500;

export const outfitChatModelSchema = z.object({
  answer: z.string().min(1).max(ANSWER_MAX_LENGTH),
});

export type OutfitChatModelOutput = z.infer<typeof outfitChatModelSchema>;

export const outfitChatJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'string',
      maxLength: ANSWER_MAX_LENGTH,
    },
  },
  required: ['answer'],
} as const;
