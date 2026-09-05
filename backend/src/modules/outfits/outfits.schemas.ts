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
  // Set only when the request was closetOnly — real closet item ids
  // this recommendation's keyPieces/shoes/accessories resolve to.
  closetItemIds: z.array(z.string()).optional(),
});

export const tieredOutfitGenerationSchema = z.object({
  recommendations: z.array(outfitRecommendationSchema).min(1).max(3),
});

export const singleTierRegenerationSchema = z.object({
  recommendation: outfitRecommendationSchema,
});

export type TieredOutfitGeneration = z.infer<typeof tieredOutfitGenerationSchema>;
export type SingleTierRegeneration = z.infer<typeof singleTierRegenerationSchema>;

// ── Closet-only variant — keyPieces/shoes/accessories are real closet item
// ids (constrained to per-tier, per-role shortlists via the JSON schema's
// own enum), not free-invented pieces. anchorPiece stays free-form since the
// anchor is user-supplied and not guaranteed to be a real closet item.
// Server-side resolution (outfits.service.ts) maps the chosen ids back to
// real items and synthesizes outfitPieceSchema-shaped objects before this
// converges with the freeform path's mapOutfitRecommendation.
export const closetOnlyOutfitRecommendationSchema = z.object({
  tier: tierEnum,
  title: z.string().min(1),
  anchorItem: z.string().min(1),
  anchorPiece: outfitPieceSchema.optional(),
  keyPieceIds: z.array(z.string()).min(1).max(5),
  shoeIds: z.array(z.string()).min(1).max(3),
  accessoryIds: z.array(z.string()).min(0).max(4),
  fitNotes: z.array(z.string().min(1)).min(2).max(5),
  whyItWorks: z.string().min(1),
  stylingDirection: z.string().min(1),
  detailNotes: z.array(z.string().min(1)).min(2).max(5),
});

export const closetOnlyTieredOutfitGenerationSchema = z.object({
  recommendations: z.array(closetOnlyOutfitRecommendationSchema).min(1).max(3),
});

export const closetOnlySingleTierRegenerationSchema = z.object({
  recommendation: closetOnlyOutfitRecommendationSchema,
});

export type ClosetOnlyOutfitRecommendation = z.infer<typeof closetOnlyOutfitRecommendationSchema>;

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

function buildOutfitRecommendationJsonSchema() {
  return {
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
    required: [
      'tier', 'title', 'anchorItem', 'anchorPiece', 'keyPieces', 'shoes', 'accessories', 'fitNotes', 'whyItWorks', 'stylingDirection', 'detailNotes',
    ],
  } as const;
}

// ── Closet-only JSON schema variants — keyPieceIds/shoeIds/accessoryIds are
// id arrays whose `enum` is the union of every requested tier's shortlist
// for that role (closet-outfit-builder.ts's buildOutfitSlotShortlists). The
// union (not a single shared list) is a deliberate looseness: JSON schema
// can't easily vary an array item's enum by the array's own position, so
// per-tier precision (a business recommendation can't secretly use a
// casual-only id) is enforced by outfits.service.ts post-validation instead —
// the enum here is the API-level guardrail against invented/wrong-role ids.

export type ClosetOnlyRoleIds = { keyPieces: string[]; shoes: string[]; accessories: string[] };

function buildClosetOnlyOutfitRecommendationJsonSchema(roleIds: ClosetOnlyRoleIds) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      tier: { type: 'string', enum: tierEnum.options },
      title: { type: 'string' },
      anchorItem: { type: 'string' },
      anchorPiece: {
        ...outfitPieceJsonSchema,
        description: 'The anchor item as a structured piece — display_name matches anchorItem text, metadata reflects the anchor\'s category, dominant color, material, and formality.',
      },
      keyPieceIds: {
        type: 'array',
        items: { type: 'string', enum: roleIds.keyPieces },
        minItems: 1,
        maxItems: 5,
        description: 'Real closet item ids for supporting key pieces (bottoms/tops/layers/outerwear) that complement the anchor.',
      },
      shoeIds: {
        type: 'array',
        items: { type: 'string', enum: roleIds.shoes },
        minItems: 1,
        maxItems: 3,
        description: 'Real closet item id(s) for footwear.',
      },
      accessoryIds: {
        type: 'array',
        items: { type: 'string', enum: roleIds.accessories },
        minItems: 0,
        maxItems: 4,
        description: 'Real closet item ids for accessories (watch/sunglasses, plus hat/bag only if the user opted in) — empty if the closet genuinely offers none.',
      },
      fitNotes: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
      whyItWorks: { type: 'string' },
      stylingDirection: { type: 'string' },
      detailNotes: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    },
    required: ['tier', 'title', 'anchorItem', 'anchorPiece', 'keyPieceIds', 'shoeIds', 'accessoryIds', 'fitNotes', 'whyItWorks', 'stylingDirection', 'detailNotes'],
  } as const;
}

export function buildClosetOnlyTieredOutfitGenerationJsonSchema(unionRoleIds: ClosetOnlyRoleIds, count: number) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendations: {
        type: 'array',
        items: buildClosetOnlyOutfitRecommendationJsonSchema(unionRoleIds),
        minItems: count,
        maxItems: count,
      },
    },
    required: ['recommendations'],
  } as const;
}

export function buildClosetOnlySingleTierRegenerationJsonSchema(roleIds: ClosetOnlyRoleIds) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendation: buildClosetOnlyOutfitRecommendationJsonSchema(roleIds),
    },
    required: ['recommendation'],
  } as const;
}

export function buildTieredOutfitGenerationJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendations: {
        type: 'array',
        items: buildOutfitRecommendationJsonSchema(),
        minItems: 1,
        maxItems: 3,
      },
    },
    required: ['recommendations'],
  } as const;
}

export function buildSingleTierRegenerationJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      recommendation: buildOutfitRecommendationJsonSchema(),
    },
    required: ['recommendation'],
  } as const;
}
