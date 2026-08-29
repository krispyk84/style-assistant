import { z } from 'zod';

export const LIFECYCLE_VALUES = ['emerging', 'current', 'established', 'declining'] as const;

const fashionTrendSchema = z.object({
  rank: z.number().int().min(1).max(10),
  name: z.string().min(1),
  summary: z.string().min(1),
  whyItMattersNow: z.string().min(1),
  garmentCategories: z.array(z.string()),
  silhouettes: z.array(z.string()),
  colours: z.array(z.string()),
  materialsOrTextures: z.array(z.string()),
  footwear: z.array(z.string()),
  accessories: z.array(z.string()),
  stylingRules: z.array(z.string()),
  avoid: z.array(z.string()),
  trendStrength: z.number().int().min(1).max(10),
  lifecycle: z.enum(LIFECYCLE_VALUES),
  versatility: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(1),
});

export type FashionTrend = z.infer<typeof fashionTrendSchema>;

// Every list must be exactly 10, cover ranks 1-10 with no repeats, and have
// no two trends sharing a name — a length(10) check alone wouldn't catch a
// model that returns ten trends all ranked #1, or the same trend twice.
function trendListSchema(label: string) {
  return z
    .array(fashionTrendSchema)
    .length(10, `${label} must contain exactly 10 trends`)
    .superRefine((trends, ctx) => {
      const ranks = new Set(trends.map((t) => t.rank));
      if (ranks.size !== trends.length || ![...ranks].every((r) => r >= 1 && r <= 10)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} ranks must be a 1-10 permutation with no duplicates` });
      }
      const names = new Set(trends.map((t) => t.name.trim().toLowerCase()));
      if (names.size !== trends.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} contains duplicate trend names` });
      }
    });
}

export const seasonalTrendProfileResponseSchema = z.object({
  season: z.string(),
  year: z.number().int(),
  fashionGender: z.string(),
  region: z.string(),
  generatedAt: z.string(),
  business: trendListSchema('business'),
  smartCasual: trendListSchema('smartCasual'),
  casual: trendListSchema('casual'),
});

export type SeasonalTrendProfileResponse = z.infer<typeof seasonalTrendProfileResponseSchema>;

const FASHION_TREND_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rank: { type: 'integer' },
    name: { type: 'string' },
    summary: { type: 'string' },
    whyItMattersNow: { type: 'string' },
    garmentCategories: { type: 'array', items: { type: 'string' } },
    silhouettes: { type: 'array', items: { type: 'string' } },
    colours: { type: 'array', items: { type: 'string' } },
    materialsOrTextures: { type: 'array', items: { type: 'string' } },
    footwear: { type: 'array', items: { type: 'string' } },
    accessories: { type: 'array', items: { type: 'string' } },
    stylingRules: { type: 'array', items: { type: 'string' } },
    avoid: { type: 'array', items: { type: 'string' } },
    trendStrength: { type: 'integer' },
    lifecycle: { type: 'string', enum: LIFECYCLE_VALUES },
    versatility: { type: 'integer' },
    confidence: { type: 'number' },
  },
  required: [
    'rank', 'name', 'summary', 'whyItMattersNow', 'garmentCategories', 'silhouettes',
    'colours', 'materialsOrTextures', 'footwear', 'accessories', 'stylingRules', 'avoid',
    'trendStrength', 'lifecycle', 'versatility', 'confidence',
  ],
} as const;

// Gemini's responseSchema (Google's OpenAPI-3-subset dialect) — a separate,
// slightly different-shaped declaration from the Zod schema above by
// necessity, but the two are kept structurally in lockstep; the Zod schema is
// what actually gets enforced/trusted after parsing.
export const SEASONAL_TRENDS_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    season: { type: 'string' },
    year: { type: 'integer' },
    fashionGender: { type: 'string' },
    region: { type: 'string' },
    generatedAt: { type: 'string' },
    business: { type: 'array', items: FASHION_TREND_JSON_SCHEMA },
    smartCasual: { type: 'array', items: FASHION_TREND_JSON_SCHEMA },
    casual: { type: 'array', items: FASHION_TREND_JSON_SCHEMA },
  },
  required: ['season', 'year', 'fashionGender', 'region', 'generatedAt', 'business', 'smartCasual', 'casual'],
} as const;
