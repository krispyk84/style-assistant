import { z } from 'zod';

const verdictEnum = z.enum(['Works great', 'Works okay', "Doesn't work"]);
const strengthEnum = z.enum(['Strong', 'Moderate', 'Weak']);

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

// ── Selfie Review ─────────────────────────────────────────────────────────────

const fidelityEnum = z.enum(['Close', 'Adjusted', 'Different']);

export const selfieReviewModelSchema = z.object({
  verdict:           verdictEnum,
  lookFidelity:      fidelityEnum,  // how closely the worn look follows the recommendation
  overallLook:       strengthEnum,  // how well the final result works as an outfit
  summary:           z.string().min(1).max(300),
  substitutionImpact: z.array(z.string().min(1).max(200)).max(3),
});

export const selfieReviewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict:            { type: 'string', enum: verdictEnum.options },
    lookFidelity:       { type: 'string', enum: fidelityEnum.options },
    overallLook:        { type: 'string', enum: strengthEnum.options },
    summary:            { type: 'string' },
    substitutionImpact: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'lookFidelity', 'overallLook', 'summary', 'substitutionImpact'],
} as const;

export type CompatibilityModelOutput = z.infer<typeof compatibilityModelSchema>;
export type SelfieReviewModelOutput   = z.infer<typeof selfieReviewModelSchema>;
