import { z } from 'zod';

const tierEnum = z.enum(['business', 'smart-casual', 'casual']);
const verdictEnum = z.enum(['Works great', 'Works okay', "Doesn't work"]);

const OUTFIT_PIECE_CATEGORIES = [
  'Bag', 'Belt', 'Blazer', 'Boots', 'Cardigan', 'Coat', 'Denim', 'Gloves',
  'Hat', 'Hoodie', 'Knitwear', 'Loafers', 'Outerwear', 'Overshirt', 'Polo', 'Scarf',
  'Shirt', 'Shoes', 'Shorts', 'Sneakers', 'Socks', 'Suit', 'Sunglasses', 'Sweatpants',
  'Sweatshirt', 'Swim Shirt', 'Swimming Shorts', 'T-Shirt', 'Tank Top', 'Tie', 'Trousers',
  'Vest', 'Watch',
] as const;

const outfitPieceCategoryEnum = z.enum(OUTFIT_PIECE_CATEGORIES);
const outfitPieceFormalityEnum = z.enum(['Casual', 'Smart Casual', 'Refined Casual', 'Formal']);

const outfitPieceMetaSchema = z.object({
  category: outfitPieceCategoryEnum,
  color: z.string().min(1),
  material: z.string().nullable().optional(),
  formality: outfitPieceFormalityEnum,
});

const outfitPieceSchema = z.object({
  display_name: z.string().min(1),
  metadata: outfitPieceMetaSchema,
});

export const outfitRecommendationSchema = z.object({
  tier: tierEnum,
  title: z.string().min(1),
  anchorItem: z.string().min(1),
  keyPieces: z.array(outfitPieceSchema).min(2).max(5),
  shoes: z.array(outfitPieceSchema).min(1).max(3),
  accessories: z.array(outfitPieceSchema).min(1).max(4),
  fitNotes: z.array(z.string().min(1)).min(2).max(5),
  whyItWorks: z.string().min(1),
  stylingDirection: z.string().min(1),
  detailNotes: z.array(z.string().min(1)).min(2).max(5),
});

export const tieredOutfitGenerationSchema = z.object({
  recommendations: z.array(outfitRecommendationSchema).min(1).max(3),
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

const outfitPieceMetaJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: {
      type: 'string',
      enum: OUTFIT_PIECE_CATEGORIES,
      description: 'Canonical garment category — must be one of the exact enum values.',
    },
    color: {
      type: 'string',
      minLength: 1,
      description: 'Dominant color of the piece, e.g. "Navy", "Stone", "Off-white".',
    },
    material: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Primary fabric or material if relevant, e.g. "Merino wool", "Cotton". Null if not applicable.',
    },
    formality: {
      type: 'string',
      enum: outfitPieceFormalityEnum.options,
      description: 'Formality level of this specific piece.',
    },
  },
  required: ['category', 'color', 'material', 'formality'],
} as const;

const outfitPieceJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    display_name: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable description shown in the UI, e.g. "Fine-gauge navy merino crewneck".',
    },
    metadata: outfitPieceMetaJsonSchema,
  },
  required: ['display_name', 'metadata'],
} as const;

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
      items: outfitPieceJsonSchema,
    },
    shoes: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: outfitPieceJsonSchema,
    },
    accessories: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: outfitPieceJsonSchema,
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
      minItems: 1,
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
      minLength: 1,
    },
  },
  required: ['perspective'],
} as const;
