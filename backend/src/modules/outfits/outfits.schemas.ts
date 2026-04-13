import { z } from 'zod';

const tierEnum = z.enum(['business', 'smart-casual', 'casual']);

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
  // Optional for backwards compatibility — old stored responses parse without it.
  // Always required in the OpenAI JSON schema so new responses always include it.
  anchorPiece: outfitPieceSchema.optional(),
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

export type TieredOutfitGeneration = z.infer<typeof tieredOutfitGenerationSchema>;
export type SingleTierRegeneration = z.infer<typeof singleTierRegenerationSchema>;

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
    },
    anchorItem: {
      type: 'string',
    },
    anchorPiece: {
      ...outfitPieceJsonSchema,
      description: 'The anchor item as a structured piece — display_name matches anchorItem text, metadata reflects the anchor\'s category, dominant color, material, and formality.',
    },
    keyPieces: {
      type: 'array',
      items: outfitPieceJsonSchema,
      minItems: 2,
      maxItems: 5,
    },
    shoes: {
      type: 'array',
      items: outfitPieceJsonSchema,
      minItems: 1,
      maxItems: 3,
    },
    accessories: {
      type: 'array',
      items: outfitPieceJsonSchema,
      minItems: 1,
      maxItems: 4,
    },
    fitNotes: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 5,
    },
    whyItWorks: {
      type: 'string',
    },
    stylingDirection: {
      type: 'string',
    },
    detailNotes: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 5,
    },
  },
  required: ['tier', 'title', 'anchorItem', 'anchorPiece', 'keyPieces', 'shoes', 'accessories', 'fitNotes', 'whyItWorks', 'stylingDirection', 'detailNotes'],
} as const;

export const tieredOutfitGenerationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendations: {
      type: 'array',
      items: outfitRecommendationJsonSchema,
      minItems: 1,
      maxItems: 3,
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
