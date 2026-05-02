import { z } from 'zod';

// ── Closet sketch — footwear vision description ───────────────────────────────
// Much richer than the garment schema — captures the specific construction cues
// that distinguish technical sneakers from generic ones, etc.

export const footwearDescriptionSchema = z.object({
  type:                z.string(),
  color:               z.string(),
  colorDetails:        z.string(),
  primaryMaterial:     z.string(),
  secondaryMaterials:  z.string(),
  toeShape:            z.string(),
  silhouetteProfile:   z.string(),
  vampConstruction:    z.string(),
  fasteningSystem:     z.string(),
  soleProfile:         z.string(),
  heelType:            z.string(),
  upperPaneling:       z.string(),
  stitchingDetails:    z.string(),
  hardwareDetails:     z.string(),
  distinctiveFeatures: z.string(),
  brandLanguage:       z.string(),
  stylingNotes:        z.string(),
  mustPreserve:        z.array(z.string()).max(6),
});

// ── Closet sketch — enhanced garment vision description ───────────────────────
// Extends the original 6-field schema with construction and standout features.

export const enhancedGarmentDescriptionSchema = z.object({
  type:                z.string(),
  color:               z.string(),
  material:            z.string(),
  silhouette:          z.string(),
  details:             z.string(),
  constructionDetails: z.string(),
  standoutFeatures:    z.string(),
  stylingNotes:        z.string(),
  mustPreserve:        z.array(z.string()).max(5),
});

// ── Closet item analysis (vision → structured metadata) ───────────────────────

export const analyzeResponseSchema = z.object({
  title: z.string(),
  category: z.string(),
  brand: z.string(),
  subcategory: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  colorFamily: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  formality: z.string().nullable().optional(),
  silhouette: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
  lensShape: z.string().nullable().optional(),
  frameColor: z.string().nullable().optional(),
});

// ── Closet match (LLM picks a closet item per outfit suggestion) ──────────────

export const matchResponseSchema = z.object({
  matches: z.array(
    z.object({
      suggestionIndex: z.number(),
      matchedItemId: z.string().nullable(),
    }),
  ),
});

// ── Closet analyser (Vittorio + Alessandra recommendations) ───────────────────

const recommendationItemSchema = z.object({
  piece_name: z.string(),
  reason: z.string(),
  versatility_tags: z.array(z.string()),
  impact_score: z.number(),
});

const stylistResultSchema = z.object({
  has_recommendations: z.boolean(),
  no_gap_message: z.string(),
  recommendations: z.array(recommendationItemSchema).max(2),
});

export const closetAnalysisSchema = z.object({
  total_score: z.number(),
  summary: z.string(),
  sub_scores: z.object({
    formality_range: z.number(),
    color_versatility: z.number(),
    seasonal_coverage: z.number(),
    layering_options: z.number(),
    occasion_coverage: z.number(),
  }),
  vittorio: stylistResultSchema,
  alessandra: stylistResultSchema,
});

export const CLOSET_ANALYSIS_JSON_SCHEMA = {
  name: 'closet_analysis_response',
  schema: {
    type: 'object' as const,
    properties: {
      total_score: { type: 'number', description: 'Overall closet versatility score 0-100' },
      summary: { type: 'string', description: '2-3 sentence plain-English summary specific to this closet' },
      sub_scores: {
        type: 'object',
        properties: {
          formality_range: { type: 'number', description: 'Score 0-10' },
          color_versatility: { type: 'number', description: 'Score 0-10' },
          seasonal_coverage: { type: 'number', description: 'Score 0-10' },
          layering_options: { type: 'number', description: 'Score 0-10' },
          occasion_coverage: { type: 'number', description: 'Score 0-10' },
        },
        required: ['formality_range', 'color_versatility', 'seasonal_coverage', 'layering_options', 'occasion_coverage'],
        additionalProperties: false,
      },
      vittorio: {
        type: 'object',
        properties: {
          has_recommendations: { type: 'boolean' },
          no_gap_message: { type: 'string', description: 'One sentence in Vittorio\'s voice when has_recommendations is false. Empty string otherwise.' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                piece_name: { type: 'string' },
                reason: { type: 'string', description: 'Sharp, precise, European — Vittorio\'s voice' },
                versatility_tags: { type: 'array', items: { type: 'string' } },
                impact_score: { type: 'number', description: '1-10: how much this piece improves the wardrobe' },
              },
              required: ['piece_name', 'reason', 'versatility_tags', 'impact_score'],
              additionalProperties: false,
            },
          },
        },
        required: ['has_recommendations', 'no_gap_message', 'recommendations'],
        additionalProperties: false,
      },
      alessandra: {
        type: 'object',
        properties: {
          has_recommendations: { type: 'boolean' },
          no_gap_message: { type: 'string', description: 'One sentence in Alessandra\'s voice when has_recommendations is false. Empty string otherwise.' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                piece_name: { type: 'string' },
                reason: { type: 'string', description: 'Culturally fluent, warm, expressive — Alessandra\'s voice' },
                versatility_tags: { type: 'array', items: { type: 'string' } },
                impact_score: { type: 'number', description: '1-10: how much this piece improves the wardrobe' },
              },
              required: ['piece_name', 'reason', 'versatility_tags', 'impact_score'],
              additionalProperties: false,
            },
          },
        },
        required: ['has_recommendations', 'no_gap_message', 'recommendations'],
        additionalProperties: false,
      },
    },
    required: ['total_score', 'summary', 'sub_scores', 'vittorio', 'alessandra'],
    additionalProperties: false,
  },
  strict: true,
};

// ── Help Me Pick (LLM picks today's anchor) ───────────────────────────────────

export const helpMePickResponseSchema = z.object({
  itemId: z.string(),
  reason: z.string(),
});

export const HELP_ME_PICK_JSON_SCHEMA = {
  name: 'help_me_pick_response',
  schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'The id of the selected closet item' },
      reason: { type: 'string', description: 'One sentence explaining why this piece is the right anchor today' },
    },
    required: ['itemId', 'reason'],
    additionalProperties: false,
  },
  strict: true,
};
