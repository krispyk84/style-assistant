import { z } from 'zod';

// ── AI structured response shape ─────────────────────────────────────────────
// Note: server computes overallScore + verdict deterministically from scores +
// weights, so the model does NOT return them — keeps the math explainable and
// stable across runs.

const scoreField = z.number().min(0).max(100);

const itemSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  primaryColor: z.string().nullable(),
  colorFamily: z.string().nullable(),
  material: z.string().nullable(),
  formality: z.string().nullable(),
});

const scoresSchema = z.object({
  trendiness: scoreField,
  profileFit: scoreField,
  redundancyComplementarity: scoreField,
  stylistOpinion: scoreField,
  utility: scoreField,
});

const reasoningSchema = z.object({
  trendiness: z.string().min(1),
  profileFit: z.string().min(1),
  redundancyComplementarity: z.string().min(1),
  stylistOpinion: z.string().min(1),
  utility: z.string().min(1),
});

export const closetFitCheckAiSchema = z.object({
  item: itemSchema,
  scores: scoresSchema,
  summary: z.string().min(1),
  reasoning: reasoningSchema,
  closetImpact: z.string().min(1),
  stylistTake: z.string().min(1),
  similarClosetItemIds: z.array(z.string()).max(4),
});

export type ClosetFitCheckAiOutput = z.infer<typeof closetFitCheckAiSchema>;

const stringOrNull = { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] };

export const CLOSET_FIT_CHECK_JSON_SCHEMA = {
  name: 'closet_fit_check_response',
  description: 'Honest five-dimension evaluation of a candidate piece against the user\'s profile and closet.',
  schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      item: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Concise product-style title, e.g. "Cream Wool Sport Coat"' },
          category: { type: 'string', description: 'Single canonical garment category (e.g. Blazer, Coat, Trousers, Shirt, Sneakers, Bag)' },
          primaryColor: { ...stringOrNull, description: 'Primary color name, or null if not determinable' },
          colorFamily: { ...stringOrNull, description: 'Broad color family for matching (white, stone, grey, black, navy, blue, brown, olive, green, burgundy, red, pink, yellow, purple, rust, camel)' },
          material: { ...stringOrNull, description: 'Primary fabric, or null' },
          formality: { ...stringOrNull, description: 'Casual | Smart Casual | Refined Casual | Formal, or null' },
        },
        required: ['title', 'category', 'primaryColor', 'colorFamily', 'material', 'formality'],
      },
      scores: {
        type: 'object',
        additionalProperties: false,
        properties: {
          trendiness:                 { type: 'number', description: '0–100 — relevant / current right now, adjusted for user trendiness preference' },
          profileFit:                 { type: 'number', description: '0–100 — fit with user style, color, body, aesthetic' },
          redundancyComplementarity:  { type: 'number', description: '0–100 — HIGHER = more complementary, LOWER = more redundant with current closet' },
          stylistOpinion:             { type: 'number', description: '0–100 — independent design taste judgment' },
          utility:                    { type: 'number', description: '0–100 — how many outfits the user can build with it from their current closet' },
        },
        required: ['trendiness', 'profileFit', 'redundancyComplementarity', 'stylistOpinion', 'utility'],
      },
      summary: { type: 'string', description: '1–2 sentence direct verdict line. Honest.' },
      reasoning: {
        type: 'object',
        additionalProperties: false,
        properties: {
          trendiness:                { type: 'string', description: 'Short paragraph (2–3 sentences) on trendiness, specific to this piece.' },
          profileFit:                { type: 'string', description: 'Short paragraph on profile fit, citing concrete profile traits.' },
          redundancyComplementarity: { type: 'string', description: 'Short paragraph naming specific closet items it overlaps with or specific gaps it fills.' },
          stylistOpinion:            { type: 'string', description: 'Short paragraph on independent design taste.' },
          utility:                   { type: 'string', description: 'Short paragraph on pairing potential within this closet.' },
        },
        required: ['trendiness', 'profileFit', 'redundancyComplementarity', 'stylistOpinion', 'utility'],
      },
      closetImpact: { type: 'string', description: 'Paragraph naming real closet items by title — overlap or gap-fill — specific not generic.' },
      stylistTake: { type: 'string', description: 'Paragraph in a sharp, tasteful, fashion-literate stylist voice. No exclamation marks. Direct, honest.' },
      similarClosetItemIds: {
        type: 'array',
        description: '0–4 closet item IDs (from the supplied inventory) that this candidate most overlaps with. Empty array if no meaningful overlap.',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
    required: ['item', 'scores', 'summary', 'reasoning', 'closetImpact', 'stylistTake', 'similarClosetItemIds'],
  },
  strict: true,
};

// ── Request validation ───────────────────────────────────────────────────────

export const closetFitCheckRequestSchema = z.object({
  uploadedImageId: z.string().optional(),
  uploadedImageUrl: z.string().url(),
  notes: z.string().trim().max(500).optional(),
  trendiness: z.number().min(0).max(100).optional(),
});

export type ClosetFitCheckRequestPayload = z.infer<typeof closetFitCheckRequestSchema>;
