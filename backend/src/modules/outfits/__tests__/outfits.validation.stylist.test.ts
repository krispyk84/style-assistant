import { describe, expect, it } from 'vitest';

import { generateOutfitsSchema, inferStylistTierSchema } from '../outfits.validation.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Confirms the "Ask a Stylist" additions to the request schema are additive
// and optional — the original structured-form request (no stylistId at all)
// must keep validating exactly as before.

const BASE_REQUEST = {
  requestId: 'req-1',
  anchorItemDescription: 'navy blazer',
  photoPending: false,
  selectedTiers: ['smart-casual'],
};

describe('generateOutfitsSchema — stylistId', () => {
  it('the original request shape (no stylistId) still validates', () => {
    const result = generateOutfitsSchema.safeParse(BASE_REQUEST);
    expect(result.success).toBe(true);
  });

  it('accepts stylistId "vittorio"', () => {
    const result = generateOutfitsSchema.safeParse({ ...BASE_REQUEST, stylistId: 'vittorio' });
    expect(result.success).toBe(true);
  });

  it('accepts stylistId "alessandra"', () => {
    const result = generateOutfitsSchema.safeParse({ ...BASE_REQUEST, stylistId: 'alessandra' });
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized stylistId', () => {
    const result = generateOutfitsSchema.safeParse({ ...BASE_REQUEST, stylistId: 'someone-else' });
    expect(result.success).toBe(false);
  });
});

describe('inferStylistTierSchema', () => {
  it('requires a non-empty stylistBrief', () => {
    expect(inferStylistTierSchema.safeParse({ stylistBrief: '' }).success).toBe(false);
    expect(inferStylistTierSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a real brief', () => {
    const result = inferStylistTierSchema.safeParse({ stylistBrief: 'drinks with friends downtown' });
    expect(result.success).toBe(true);
  });
});
