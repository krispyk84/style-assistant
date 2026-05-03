import { z } from 'zod';

import { strengthEnum, verdictEnum } from '../compatibility/compatibility.schemas.js';

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

export type SelfieReviewModelOutput = z.infer<typeof selfieReviewModelSchema>;
