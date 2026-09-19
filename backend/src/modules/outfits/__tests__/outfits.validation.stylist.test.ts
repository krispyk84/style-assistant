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

// ── additionalDetails length — S2 fix ───────────────────────────────────────
//
// Pre-push audit finding: StylistBriefInput's maxLength (1000) and
// inferStylistTierSchema's cap (1000, above) both let a stylist brief through
// at up to 1000 characters, but generateOutfitsSchema's additionalDetails
// previously stayed capped at 500 — a 501-1000 character brief would pass
// the form and tier inference, then fail here at the actual generation call,
// after the user had already been navigated to the results screen. Raised to
// 1000 to match. This is the exact field the "Ask a Stylist" brief travels
// through (see StylistOutfitFormContainer.tsx's additionalDetails: stylistBrief).
describe('generateOutfitsSchema — additionalDetails length (1000-char stylist brief compatibility)', () => {
  it('a 1000-character stylist brief reaches the generation endpoint successfully (passes validation)', () => {
    const result = generateOutfitsSchema.safeParse({
      ...BASE_REQUEST,
      stylistId: 'alessandra',
      additionalDetails: 'x'.repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it('a 1001-character brief is rejected', () => {
    const result = generateOutfitsSchema.safeParse({
      ...BASE_REQUEST,
      stylistId: 'alessandra',
      additionalDetails: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('a 501-character brief (previously rejected by the old 500 cap) now validates', () => {
    const result = generateOutfitsSchema.safeParse({
      ...BASE_REQUEST,
      stylistId: 'vittorio',
      additionalDetails: 'x'.repeat(501),
    });
    expect(result.success).toBe(true);
  });

  it('the original flow (no stylistId) also benefits from the raised cap — purely permissive, nothing that validated before now fails', () => {
    const result = generateOutfitsSchema.safeParse({ ...BASE_REQUEST, additionalDetails: 'x'.repeat(500) });
    expect(result.success).toBe(true);
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
