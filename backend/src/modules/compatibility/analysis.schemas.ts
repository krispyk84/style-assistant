import { z } from 'zod';

const verdictEnum = z.enum(['Works great', 'Works okay', "Doesn't work"]);

export const compatibilityModelSchema = z.object({
  verdict: verdictEnum,
  explanation: z.string().min(1),
  concerns: z.array(z.string().min(1)).min(1).max(4),
  suggestedAlternatives: z.array(z.string().min(1)).min(1).max(4),
});

export const selfieReviewModelSchema = z.object({
  verdict: verdictEnum,
  strengths: z.array(z.string().min(1)).min(1).max(4),
  issues: z.array(z.string().min(1)).min(1).max(4),
  recommendedAdjustments: z.array(z.string().min(1)).min(1).max(4),
});

export type CompatibilityModelOutput = z.infer<typeof compatibilityModelSchema>;
export type SelfieReviewModelOutput = z.infer<typeof selfieReviewModelSchema>;

export const compatibilityJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: {
      type: 'string',
      enum: verdictEnum.options,
    },
    explanation: {
      type: 'string',
    },
    concerns: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    suggestedAlternatives: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['verdict', 'explanation', 'concerns', 'suggestedAlternatives'],
} as const;

export const selfieReviewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: {
      type: 'string',
      enum: verdictEnum.options,
    },
    strengths: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    recommendedAdjustments: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['verdict', 'strengths', 'issues', 'recommendedAdjustments'],
} as const;
