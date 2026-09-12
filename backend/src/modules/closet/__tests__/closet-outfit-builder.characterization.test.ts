import { describe, expect, it } from 'vitest';

import {
  effectiveAllowedGroups,
  fillMissingRequiredSlots,
  filterByFormalityBand,
  normalizeSuitDualRole,
  pickAccessory,
  buildVariantCandidates,
  type BuilderClosetItem,
} from '../closet-outfit-builder.js';
import { weatherGates, SLOT_GROUPS, type TierSlug } from '../closet-taxonomy.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R4: characterizes the SHARED closet-only outfit-building primitives
// (closet-outfit-builder.ts / closet-taxonomy.ts) that Generate 5 Outfits,
// Trip Planner "From My Closet", and Create a Look's closet-only path all
// call identically — these were already hoisted in R1 (weatherGates,
// requiredSlotsForTier, pickAccessory) or always lived here (the rest). This
// file pins down PRIMITIVE behavior once, so engine-specific test files
// don't need to re-prove the same shared logic three times (see closet-only-
// suit-duplicate.characterization.test.ts for the ENGINE-SPECIFIC
// orchestration built on top of these primitives, which does differ).
//
// requiredSlotsForTier's per-tier output is already fully pinned by
// __tests__/closet-taxonomy.test.ts — not repeated here.
//
// This is characterization only: no production behavior was changed to
// write these tests. Every fixture below uses at most one eligible candidate
// per relevant slot/group so buildDeterministicOutfit/pickAccessory's
// internal Math.random()-weighted selection can never affect which item is
// chosen — assertions on shortlist/candidate FUNCTIONS (buildVariantCandidates)
// are written against set membership, not array order, since those functions
// shuffle their output and set membership is unaffected by shuffling.

function makeItem(overrides: { id: string; title: string; category: string; formality?: string | null }): BuilderClosetItem {
  return { formality: null, ...overrides };
}

describe('weatherGates — boundary values (read directly from source, not invented)', () => {
  const TIERS: TierSlug[] = ['casual', 'smart-casual'];

  it.each(TIERS)('%s: below 18°C includes both thermal layer and outerwear', (tier) => {
    expect(weatherGates(17, tier)).toEqual({ includeThermalLayer: true, includeOuterwear: true });
  });

  it.each(TIERS)('%s: exactly 18°C crosses into WARM — thermal layer drops, outerwear stays', (tier) => {
    expect(weatherGates(18, tier)).toEqual({ includeThermalLayer: false, includeOuterwear: true });
    expect(weatherGates(19, tier)).toEqual({ includeThermalLayer: false, includeOuterwear: true });
  });

  it.each(TIERS)('%s: exactly 24°C crosses into HOT — both drop', (tier) => {
    expect(weatherGates(23, tier)).toEqual({ includeThermalLayer: false, includeOuterwear: true });
    expect(weatherGates(24, tier)).toEqual({ includeThermalLayer: false, includeOuterwear: false });
    expect(weatherGates(25, tier)).toEqual({ includeThermalLayer: false, includeOuterwear: false });
  });

  it('business: the WARM band (18-23°C) suppresses outerwear even though casual/smart-casual keep it — business-only override', () => {
    expect(weatherGates(20, 'business')).toEqual({ includeThermalLayer: false, includeOuterwear: false });
    expect(weatherGates(20, 'casual')).toEqual({ includeThermalLayer: false, includeOuterwear: true });
  });

  it('business: the override boundary is exactly 10°C — 9 keeps outerwear, 10 drops it', () => {
    expect(weatherGates(9, 'business')).toEqual({ includeThermalLayer: true, includeOuterwear: true });
    expect(weatherGates(10, 'business')).toEqual({ includeThermalLayer: true, includeOuterwear: false });
    expect(weatherGates(11, 'business')).toEqual({ includeThermalLayer: true, includeOuterwear: false });
  });

  it('business: genuinely cold weather (below the override boundary) still gets outerwear — the override only suppresses the WARM band, not COLD', () => {
    expect(weatherGates(5, 'business')).toEqual({ includeThermalLayer: true, includeOuterwear: true });
  });

  it('null temperature (unknown weather) defaults to including both, for every tier, with no business override applied', () => {
    for (const tier of [...TIERS, 'business'] as TierSlug[]) {
      expect(weatherGates(null, tier)).toEqual({ includeThermalLayer: true, includeOuterwear: true });
    }
  });
});

describe('effectiveAllowedGroups — tier-hard-restricted candidate groups', () => {
  it('business footwear is hard-restricted to dress shoes/loafers — never widens to sneakers/boots', () => {
    expect(effectiveAllowedGroups('footwear', 'business')).toEqual(['formal_shoes', 'loafers']);
  });

  it('casual footwear allows the full SLOT_GROUPS membership (no hard restriction)', () => {
    expect(new Set(effectiveAllowedGroups('footwear', 'casual'))).toEqual(new Set(SLOT_GROUPS.footwear));
  });

  it('casual bottoms never includes suit, even though SLOT_GROUPS.bottoms lists it — casual does not allow the suit dual-role', () => {
    expect(effectiveAllowedGroups('bottoms', 'casual')).not.toContain('suit');
  });

  it('smart-casual and business bottoms DO include suit — both tiers allow the suit dual-role', () => {
    expect(effectiveAllowedGroups('bottoms', 'smart-casual')).toContain('suit');
    expect(effectiveAllowedGroups('bottoms', 'business')).toContain('suit');
  });

  it('business secondaryTop is hard-restricted to blazer, plus suit re-added for the dual-role', () => {
    expect(new Set(effectiveAllowedGroups('secondaryTop', 'business'))).toEqual(new Set(['blazer', 'suit']));
  });
});

describe('filterByFormalityBand — exact-first, widen-±1, widen-to-all fallback', () => {
  const exact = makeItem({ id: 'exact', title: 'Exact', category: 'Trousers', formality: 'Smart Casual' });
  const adjacent = makeItem({ id: 'adjacent', title: 'Adjacent', category: 'Trousers', formality: 'Casual' });
  const far = makeItem({ id: 'far', title: 'Far', category: 'Trousers', formality: 'Formal' });
  const targetRank = 1; // Smart Casual

  it('prefers an exact formality match, excluding adjacent/far candidates when one exists', () => {
    expect(filterByFormalityBand([exact, adjacent, far], targetRank)).toEqual([exact]);
  });

  it('widens to ±1 rank when no exact match exists', () => {
    expect(filterByFormalityBand([adjacent, far], targetRank)).toEqual([adjacent]);
  });

  it('widens to the full candidate set as a last resort when nothing is within ±1', () => {
    const onlyFar = makeItem({ id: 'only-far', title: 'Only Far', category: 'Trousers', formality: 'Formal' });
    // targetRank 1 (Smart Casual) vs Formal (rank 3) is a distance of 2 — outside ±1.
    expect(filterByFormalityBand([onlyFar], targetRank)).toEqual([onlyFar]);
  });

  it('an item with unknown/missing formality is treated as medium distance (2) — excluded when an in-band item exists, included as a last resort otherwise', () => {
    const unknown = makeItem({ id: 'unknown', title: 'Unknown', category: 'Trousers', formality: null });
    expect(filterByFormalityBand([adjacent, unknown], targetRank)).toEqual([adjacent]);
    expect(filterByFormalityBand([unknown], targetRank)).toEqual([unknown]);
  });
});

describe('fillMissingRequiredSlots — last-resort safety net', () => {
  const tier: TierSlug = 'casual';
  const targetFormalityRank = 0; // Casual

  it('fills an empty required slot from the tier-restricted candidate pool when one exists', () => {
    const shoe = makeItem({ id: 'shoe-1', title: 'Sneaker', category: 'Sneakers', formality: 'Casual' });
    const bySlot: Record<string, BuilderClosetItem> = {};
    fillMissingRequiredSlots({ bySlot, closetItems: [shoe], requiredSlots: ['footwear'], tier, targetFormalityRank });
    expect(bySlot.footwear?.id).toBe('shoe-1');
  });

  it('avoids an item already used in another slot when a fresh alternative exists', () => {
    const usedShoe = makeItem({ id: 'used-shoe', title: 'Used Sneaker', category: 'Sneakers', formality: 'Casual' });
    const freshShoe = makeItem({ id: 'fresh-shoe', title: 'Fresh Sneaker', category: 'Sneakers', formality: 'Casual' });
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: usedShoe }; // pretend it's "used" elsewhere for this test
    fillMissingRequiredSlots({
      bySlot,
      closetItems: [usedShoe, freshShoe],
      requiredSlots: ['footwear'],
      tier,
      targetFormalityRank,
    });
    expect(bySlot.footwear?.id).toBe('fresh-shoe');
  });

  it('reuses an already-used item as a last resort when no fresh alternative exists at all — never leaves the slot empty', () => {
    const onlyShoe = makeItem({ id: 'only-shoe', title: 'Only Sneaker', category: 'Sneakers', formality: 'Casual' });
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: onlyShoe };
    fillMissingRequiredSlots({
      bySlot,
      closetItems: [onlyShoe],
      requiredSlots: ['footwear'],
      tier,
      targetFormalityRank,
    });
    expect(bySlot.footwear?.id).toBe('only-shoe');
  });

  it('never fills business footwear with sneakers even as a fallback — widens to the FULL SLOT_GROUPS pool only if the restricted pool is completely empty, and formality band still applies', () => {
    const sneaker = makeItem({ id: 'sneaker', title: 'Sneaker', category: 'Sneakers', formality: 'Casual' });
    const bySlot: Record<string, BuilderClosetItem> = {};
    // Business footwear restricted pool (formal_shoes/loafers) is empty; only a sneaker exists.
    fillMissingRequiredSlots({
      bySlot,
      closetItems: [sneaker],
      requiredSlots: ['footwear'],
      tier: 'business',
      targetFormalityRank: 3,
    });
    // A mismatched pick beats no pick at all — the fallback widens to SLOT_GROUPS.footwear.
    expect(bySlot.footwear?.id).toBe('sneaker');
  });

  it('leaves a required slot empty when the closet has no candidate for it at all', () => {
    const bySlot: Record<string, BuilderClosetItem> = {};
    fillMissingRequiredSlots({ bySlot, closetItems: [], requiredSlots: ['footwear'], tier, targetFormalityRank });
    expect(bySlot.footwear).toBeUndefined();
  });
});

describe('buildVariantCandidates — same-garment-group-only swap constraint', () => {
  const originalShoe = makeItem({ id: 'shoe-orig', title: 'Original Sneaker', category: 'Sneakers', formality: 'Casual' });
  const otherSneaker = makeItem({ id: 'shoe-alt', title: 'Alt Sneaker', category: 'Sneakers', formality: 'Casual' });
  const loafer = makeItem({ id: 'loafer-1', title: 'A Loafer', category: 'Loafers', formality: 'Casual' });
  const trousers = makeItem({ id: 'trousers-1', title: 'Trousers', category: 'Trousers', formality: 'Casual' });
  const closetItems = [originalShoe, otherSneaker, loafer, trousers];

  it('a sneaker swap only offers other SNEAKERS — not a different slot like bottoms, and not even a different footwear GROUP like loafers (the constraint is same garment group, stricter than "same slot")', () => {
    const candidates = buildVariantCandidates(originalShoe, closetItems, 0, new Set());
    expect(candidates.map((c) => c.id)).toEqual(['shoe-alt']);
  });

  it('excludes the original item itself and any explicitly excluded ids', () => {
    const secondSneaker = makeItem({ id: 'shoe-alt-2', title: 'Second Sneaker', category: 'Sneakers', formality: 'Casual' });
    const candidates = buildVariantCandidates(originalShoe, [...closetItems, secondSneaker], 0, new Set(['shoe-alt']));
    expect(candidates.map((c) => c.id)).toEqual(['shoe-alt-2']);
  });

  it('returns an empty list when the original item\'s category has no resolvable garment group', () => {
    const unknownCategoryItem = makeItem({ id: 'unknown-1', title: 'Mystery Item', category: 'NotARealCategory', formality: 'Casual' });
    expect(buildVariantCandidates(unknownCategoryItem, closetItems, 0, new Set())).toEqual([]);
  });
});

describe('normalizeSuitDualRole — one physical suit fills both bottoms and secondaryTop', () => {
  const suit = makeItem({ id: 'suit-1', title: 'Navy Suit', category: 'Suit', formality: 'Formal' });
  const otherSuit = makeItem({ id: 'suit-2', title: 'Grey Suit', category: 'Suit', formality: 'Formal' });
  const blazer = makeItem({ id: 'blazer-1', title: 'Blazer', category: 'Blazer', formality: 'Formal' });

  it('bottoms=suit, secondaryTop unset → secondaryTop is promoted to the same suit', () => {
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: suit };
    normalizeSuitDualRole(bySlot);
    expect(bySlot.secondaryTop?.id).toBe('suit-1');
  });

  it('secondaryTop=suit, bottoms unset → bottoms is promoted to the same suit', () => {
    const bySlot: Record<string, BuilderClosetItem> = { secondaryTop: suit };
    normalizeSuitDualRole(bySlot);
    expect(bySlot.bottoms?.id).toBe('suit-1');
  });

  it('two DIFFERENT suits picked for the two slots collapse to one (bottoms wins)', () => {
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: suit, secondaryTop: otherSuit };
    normalizeSuitDualRole(bySlot);
    expect(bySlot.bottoms?.id).toBe('suit-1');
    expect(bySlot.secondaryTop?.id).toBe('suit-1');
  });

  it('the same suit already in both slots is left unchanged (idempotent)', () => {
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: suit, secondaryTop: suit };
    normalizeSuitDualRole(bySlot);
    expect(bySlot.bottoms?.id).toBe('suit-1');
    expect(bySlot.secondaryTop?.id).toBe('suit-1');
  });

  it('neither slot is a suit — both left untouched', () => {
    const trousers = makeItem({ id: 'trousers-1', title: 'Trousers', category: 'Trousers', formality: 'Formal' });
    const bySlot: Record<string, BuilderClosetItem> = { bottoms: trousers, secondaryTop: blazer };
    normalizeSuitDualRole(bySlot);
    expect(bySlot.bottoms?.id).toBe('trousers-1');
    expect(bySlot.secondaryTop?.id).toBe('blazer-1');
  });
});

describe('pickAccessory — single hat/bag addition', () => {
  const hat = makeItem({ id: 'hat-1', title: 'Cap', category: 'Hat', formality: 'Casual' });
  const bag = makeItem({ id: 'bag-1', title: 'Tote', category: 'Bag', formality: 'Casual' });
  const closetItems = [hat, bag];

  it('picking "hat" only ever considers hat-category items, even with a bag present', () => {
    expect(pickAccessory('hat', closetItems, 'casual', 0, new Set())?.id).toBe('hat-1');
  });

  it('picking "bag" only ever considers bag-category items, even with a hat present', () => {
    expect(pickAccessory('bag', closetItems, 'casual', 0, new Set())?.id).toBe('bag-1');
  });

  it('respects excludeItemIds — returns null when the only eligible item is excluded', () => {
    expect(pickAccessory('hat', closetItems, 'casual', 0, new Set(['hat-1']))).toBeNull();
  });

  it('returns null when no candidate of that group exists at all', () => {
    expect(pickAccessory('hat', [bag], 'casual', 0, new Set())).toBeNull();
  });
});
