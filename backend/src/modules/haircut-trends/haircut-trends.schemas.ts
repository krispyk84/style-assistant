import { z } from 'zod';

export const HAIRCUT_TREND_STYLE_COUNT = 20;
export const HAIRCUT_TREND_CLASSIFICATIONS = ['classic', 'trending'] as const;
// "A good mix, not strictly edgy trendy cuts" — enforced as a floor on both
// sides so a response can't come back all-classic or all-trending.
const MIN_PER_CLASSIFICATION = 5;

// Gemini is instructed to return a kebab-case slug for `key` but won't always
// match that exactly (stray capitals, underscores, etc.) — normalize instead
// of rejecting, so a minor formatting slip doesn't repeatedly fail validation
// and leave the profile stuck on "generating" forever.
const kebabCaseKey = z
  .string()
  .min(1)
  .transform((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
  .refine((value) => value.length > 0, 'key must contain at least one alphanumeric character');

const haircutTrendStyleSchema = z.object({
  key: kebabCaseKey,
  label: z.string().min(1),
  summary: z.string().min(1),
  classification: z.enum(HAIRCUT_TREND_CLASSIFICATIONS),
});

export type HaircutTrendStyle = z.infer<typeof haircutTrendStyleSchema>;

export const haircutTrendProfileResponseSchema = z.object({
  season: z.string(),
  year: z.number().int(),
  region: z.string(),
  generatedAt: z.string(),
  styles: z
    .array(haircutTrendStyleSchema)
    .length(HAIRCUT_TREND_STYLE_COUNT, `styles must contain exactly ${HAIRCUT_TREND_STYLE_COUNT} entries`)
    .superRefine((styles, ctx) => {
      const keys = new Set(styles.map((s) => s.key));
      if (keys.size !== styles.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'styles contains duplicate keys' });
      }
      const names = new Set(styles.map((s) => s.label.trim().toLowerCase()));
      if (names.size !== styles.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'styles contains duplicate labels' });
      }
      const classicCount = styles.filter((s) => s.classification === 'classic').length;
      const trendingCount = styles.length - classicCount;
      if (classicCount < MIN_PER_CLASSIFICATION || trendingCount < MIN_PER_CLASSIFICATION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `styles must include at least ${MIN_PER_CLASSIFICATION} classic and ${MIN_PER_CLASSIFICATION} trending entries`,
        });
      }
    }),
});

export type HaircutTrendProfileResponse = z.infer<typeof haircutTrendProfileResponseSchema>;

const HAIRCUT_TREND_STYLE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    summary: { type: 'string' },
    classification: { type: 'string', enum: HAIRCUT_TREND_CLASSIFICATIONS },
  },
  required: ['key', 'label', 'summary', 'classification'],
} as const;

// Gemini's responseSchema (Google's OpenAPI-3-subset dialect) — kept in
// lockstep with the Zod schema above; the Zod schema is what actually gets
// enforced/trusted after parsing.
export const HAIRCUT_TRENDS_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    season: { type: 'string' },
    year: { type: 'integer' },
    region: { type: 'string' },
    generatedAt: { type: 'string' },
    styles: { type: 'array', items: HAIRCUT_TREND_STYLE_JSON_SCHEMA },
  },
  required: ['season', 'year', 'region', 'generatedAt', 'styles'],
} as const;
