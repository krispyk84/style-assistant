import { z } from 'zod';

const tierEnum = z.enum(['business', 'smart-casual', 'casual']);
const verdictEnum = z.enum(['Works great', 'Works okay', "Doesn't work"]);

export const outfitRecommendationSchema = z.object({
  tier: tierEnum,
  title: z.string().min(1),
  anchorItem: z.string().min(1),
  keyPieces: z.array(z.string().min(1)).min(2).max(5),
  shoes: z.array(z.string().min(1)).min(1).max(3),
  accessories: z.array(z.string().min(1)).min(1).max(4),
  fitNotes: z.array(z.string().min(1)).min(2).max(5),
  whyItWorks: z.string().min(1),
  stylingDirection: z.string().min(1),
  detailNotes: z.array(z.string().min(1)).min(2).max(5),
});

export const tieredOutfitGenerationSchema = z.object({
  recommendations: z.array(outfitRecommendationSchema).length(3),
});

export const singleTierRegenerationSchema = z.object({
  recommendation: outfitRecommendationSchema,
});

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

export type TieredOutfitGeneration = z.infer<typeof tieredOutfitGenerationSchema>;
export type SingleTierRegeneration = z.infer<typeof singleTierRegenerationSchema>;
export type CompatibilityModelOutput = z.infer<typeof compatibilityModelSchema>;
export type SelfieReviewModelOutput = z.infer<typeof selfieReviewModelSchema>;

const outfitRecommendationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tier: {
      type: 'string',
      enum: tierEnum.options,
    },
    title: {
      type: 'string',
      minLength: 1,
    },
    anchorItem: {
      type: 'string',
      minLength: 1,
    },
    keyPieces: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    shoes: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    accessories: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    fitNotes: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    whyItWorks: {
      type: 'string',
      minLength: 1,
    },
    stylingDirection: {
      type: 'string',
      minLength: 1,
    },
    detailNotes: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
  },
  required: ['tier', 'title', 'anchorItem', 'keyPieces', 'shoes', 'accessories', 'fitNotes', 'whyItWorks', 'stylingDirection', 'detailNotes'],
} as const;

export const tieredOutfitGenerationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: outfitRecommendationJsonSchema,
    },
  },
  required: ['recommendations'],
} as const;

export const singleTierRegenerationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendation: outfitRecommendationJsonSchema,
  },
  required: ['recommendation'],
} as const;

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
      minLength: 1,
    },
    concerns: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    suggestedAlternatives: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
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
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    issues: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    recommendedAdjustments: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
  },
  required: ['verdict', 'strengths', 'issues', 'recommendedAdjustments'],
} as const;
