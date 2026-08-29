import { z } from 'zod';

// ~2 short, concrete sentences — the persona prompts alone weren't a strong
// enough constraint and outputs were routinely running 4-6 sentences long.
const PERSPECTIVE_MAX_LENGTH = 320;

export const secondOpinionModelSchema = z.object({
  perspective: z.string().min(1).max(PERSPECTIVE_MAX_LENGTH),
});

export type SecondOpinionModelOutput = z.infer<typeof secondOpinionModelSchema>;

export const secondOpinionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    perspective: {
      type: 'string',
      maxLength: PERSPECTIVE_MAX_LENGTH,
    },
  },
  required: ['perspective'],
} as const;
