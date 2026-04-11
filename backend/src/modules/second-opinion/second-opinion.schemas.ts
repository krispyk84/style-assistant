import { z } from 'zod';

export const secondOpinionModelSchema = z.object({
  perspective: z.string().min(1),
});

export type SecondOpinionModelOutput = z.infer<typeof secondOpinionModelSchema>;

export const secondOpinionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    perspective: {
      type: 'string',
    },
  },
  required: ['perspective'],
} as const;
