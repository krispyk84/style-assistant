import { z } from 'zod';

export const SEASONAL_COLOR_COUNT = 10;

// Matches types/profile.ts's SKIN_TONE_OPTIONS exactly — colours declare
// which of these they're best suited for, checked against the requesting
// user's own profile.skinTone at report-read time (not per-user generation).
export const SKIN_TONE_VALUES = ['fair', 'light', 'medium', 'olive', 'deep', 'black'] as const;

const seasonalColorSchema = z.object({
  rank: z.number().int().min(1).max(SEASONAL_COLOR_COUNT),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex must be a 6-digit hex colour like #B5502E'),
  description: z.string().min(1),
  bestSuitedSkinTones: z.array(z.enum(SKIN_TONE_VALUES)).min(1),
});

export type SeasonalColor = z.infer<typeof seasonalColorSchema>;

// Every list must be exactly SEASONAL_COLOR_COUNT, cover ranks 1-N with no
// repeats, and have no two colours sharing a name.
const colorListSchema = z
  .array(seasonalColorSchema)
  .length(SEASONAL_COLOR_COUNT, `colors must contain exactly ${SEASONAL_COLOR_COUNT} entries`)
  .superRefine((colors, ctx) => {
    const ranks = new Set(colors.map((c) => c.rank));
    if (ranks.size !== colors.length || ![...ranks].every((r) => r >= 1 && r <= SEASONAL_COLOR_COUNT)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `colors ranks must be a 1-${SEASONAL_COLOR_COUNT} permutation with no duplicates` });
    }
    const names = new Set(colors.map((c) => c.name.trim().toLowerCase()));
    if (names.size !== colors.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'colors contains duplicate colour names' });
    }
  });

export const seasonalColorPaletteResponseSchema = z.object({
  season: z.string(),
  year: z.number().int(),
  fashionGender: z.string(),
  region: z.string(),
  generatedAt: z.string(),
  colors: colorListSchema,
});

export type SeasonalColorPaletteResponse = z.infer<typeof seasonalColorPaletteResponseSchema>;

const SEASONAL_COLOR_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rank: { type: 'integer' },
    name: { type: 'string' },
    hex: { type: 'string' },
    description: { type: 'string' },
    bestSuitedSkinTones: { type: 'array', items: { type: 'string', enum: SKIN_TONE_VALUES } },
  },
  required: ['rank', 'name', 'hex', 'description', 'bestSuitedSkinTones'],
} as const;

// Gemini's responseSchema (Google's OpenAPI-3-subset dialect) — kept in
// lockstep with the Zod schema above; the Zod schema is what actually gets
// enforced/trusted after parsing.
export const SEASONAL_COLORS_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    season: { type: 'string' },
    year: { type: 'integer' },
    fashionGender: { type: 'string' },
    region: { type: 'string' },
    generatedAt: { type: 'string' },
    colors: { type: 'array', items: SEASONAL_COLOR_JSON_SCHEMA },
  },
  required: ['season', 'year', 'fashionGender', 'region', 'generatedAt', 'colors'],
} as const;
