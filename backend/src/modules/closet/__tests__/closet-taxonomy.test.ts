import { describe, it, expect } from 'vitest';

import { requiredSlotsForTier, TIER_SLOT_RULES } from '../closet-taxonomy.js';
import type { TierSlug } from '../closet-taxonomy.js';

// requiredSlotsForTier is the single authoritative reading of "which slots
// are required for tier X" — outfits.service.ts, closet-outfits.service.ts,
// and trips.service.ts all call this same function rather than each keeping
// their own copy (previously two verbatim duplicates plus one incomplete,
// hand-rolled reimplementation in outfits.service.ts that silently omitted
// footwear/watch/sunglasses). These tests pin its output for every currently
// supported tier so a future edit to TIER_SLOT_RULES can't silently change
// what's required without a test failing.

const ALL_TIERS: TierSlug[] = ['casual', 'smart-casual', 'business'];

describe('requiredSlotsForTier', () => {
  it('casual requires footwear, bottoms, primaryTop, watch, sunglasses — never secondaryTop', () => {
    expect(new Set(requiredSlotsForTier('casual'))).toEqual(
      new Set(['footwear', 'bottoms', 'primaryTop', 'watch', 'sunglasses']),
    );
  });

  it('smart-casual requires the same set as casual — secondaryTop stays optional', () => {
    expect(new Set(requiredSlotsForTier('smart-casual'))).toEqual(
      new Set(['footwear', 'bottoms', 'primaryTop', 'watch', 'sunglasses']),
    );
  });

  it('business additionally requires secondaryTop (blazer/suit jacket)', () => {
    expect(new Set(requiredSlotsForTier('business'))).toEqual(
      new Set(['footwear', 'bottoms', 'primaryTop', 'secondaryTop', 'watch', 'sunglasses']),
    );
  });

  it('never marks thermalLayer or outerwear as required for any tier — both are weather-gated, not tier-gated', () => {
    for (const tier of ALL_TIERS) {
      const required = requiredSlotsForTier(tier);
      expect(required).not.toContain('thermalLayer');
      expect(required).not.toContain('outerwear');
    }
  });

  it('never marks hat or bag as required for any tier — both stay strictly opt-in', () => {
    for (const tier of ALL_TIERS) {
      const required = requiredSlotsForTier(tier);
      expect(required).not.toContain('hat');
      expect(required).not.toContain('bag');
    }
  });

  it('exactly matches TIER_SLOT_RULES for every currently supported tier (drift guard)', () => {
    for (const tier of ALL_TIERS) {
      const expected = Object.entries(TIER_SLOT_RULES[tier])
        .filter(([, rule]) => rule.required)
        .map(([slot]) => slot);
      expect(new Set(requiredSlotsForTier(tier))).toEqual(new Set(expected));
    }
  });
});
