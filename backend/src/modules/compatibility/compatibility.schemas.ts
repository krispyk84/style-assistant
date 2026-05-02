import { z } from 'zod';

// ── Shared verdict / strength enums ───────────────────────────────────────────
// Used by both compatibility (check-piece) and selfie-review flows.

export const verdictEnum = z.enum(['Works great', 'Works okay', "Doesn't work"]);
export const strengthEnum = z.enum(['Strong', 'Moderate', 'Weak']);

// ── Compatibility (Check Outfit) ──────────────────────────────────────────────

export const compatibilityModelSchema = z.object({
  verdict:      verdictEnum,
  itemMatch:    strengthEnum,   // how closely the candidate resembles the intended piece
  outfitFit:    strengthEnum,   // how well the candidate works in the full outfit context
  summary:      z.string().min(1).max(300),
  outfitImpact: z.array(z.string().min(1).max(200)).max(3),
});

export const compatibilityJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict:      { type: 'string', enum: verdictEnum.options },
    itemMatch:    { type: 'string', enum: strengthEnum.options },
    outfitFit:    { type: 'string', enum: strengthEnum.options },
    summary:      { type: 'string' },
    outfitImpact: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'itemMatch', 'outfitFit', 'summary', 'outfitImpact'],
} as const;

export type CompatibilityModelOutput = z.infer<typeof compatibilityModelSchema>;
