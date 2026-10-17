import { describe, it, expect } from 'vitest';

import { GROUP_TO_SLOTS, requiredSlotsForTier, resolveGarmentGroup, SLOT_GROUPS, TIER_SLOT_RULES } from '../closet-taxonomy.js';
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

// resolveGarmentGroup's 'Knitwear'->'polo' title correction (this session's
// bug fix). A knit polo ("Johnny collar" sweater) is commonly catalogued
// under the generic 'Knitwear' category, which previously left it eligible
// for secondaryTop/thermalLayer — offered to the AI as a layer "worn over"
// a separately-chosen primaryTop, which stacked two collared garments (e.g.
// a dress shirt under a polo-collared sweater) despite an explicit prompt
// rule against it. Reclassifying it to the 'polo' group routes it to
// primaryTop ONLY, a structural guarantee the LLM can't override.
describe('resolveGarmentGroup — knit polo correction', () => {
  it('reclassifies a Knitwear item whose title says "polo" to the polo group', () => {
    expect(resolveGarmentGroup({ category: 'Knitwear', title: 'Navy Cashmere Johnny Collar Polo Sweater' })).toBe('polo');
    expect(resolveGarmentGroup({ category: 'Knitwear', title: 'Olive Twist Mongolian Cashmere Johnny Collar Polo' })).toBe('polo');
  });

  it('leaves a genuine crewneck/V-neck/turtleneck Knitwear item as plain knitwear — only polo-titled items are corrected', () => {
    expect(resolveGarmentGroup({ category: 'Knitwear', title: 'Charcoal Merino Crewneck Sweater' })).toBe('knitwear');
    expect(resolveGarmentGroup({ category: 'Knitwear', title: 'Black Turtleneck' })).toBe('knitwear');
  });

  it('leaves every other category\'s resolution untouched (no over-broad matching)', () => {
    expect(resolveGarmentGroup({ category: 'Polo', title: 'White Pique Polo' })).toBe('polo');
    expect(resolveGarmentGroup({ category: 'Shirt', title: 'Black Cotton Dress Shirt' })).toBe('shirt');
  });

  it('the corrected "polo" group is eligible for primaryTop and NOT for secondaryTop/thermalLayer — the actual structural fix', () => {
    expect(SLOT_GROUPS.primaryTop).toContain('polo');
    expect(SLOT_GROUPS.secondaryTop).not.toContain('polo');
    expect(SLOT_GROUPS.thermalLayer).not.toContain('polo');
    expect(GROUP_TO_SLOTS['polo']).toEqual(['primaryTop']);
  });
});
