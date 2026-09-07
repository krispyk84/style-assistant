import { describe, expect, it } from 'vitest';

import {
  buildTierRoleShortlists,
  resolveClosetOnlyRecommendation,
  weatherGates,
  type BuilderItem,
  type TierRoleIdSets,
} from '../outfits.service.js';
import type { ClosetOnlyOutfitRecommendation } from '../outfits.schemas.js';
import type { TierSlug } from '../../closet/closet-taxonomy.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// closet-taxonomy.ts's TIER_SLOT_RULES marks BOTH watch and sunglasses as
// `required: true` for every tier (casual/smart-casual/business — see
// closet-taxonomy.test.ts), and requiredSlotsForTier() surfaces that.
//
// Originally (characterized here before any fix), outfits.service.ts's
// closet-only resolution path (resolveClosetOnlyRecommendation) did NOT
// independently enforce watch/sunglasses the way it enforces footwear
// (required: true) and keyPieces (via fillMissingRequiredSlots). Watch +
// sunglasses + hat + bag + belt/scarf/tie/socks were all merged into one
// `accessories` bucket (idSets.accessories) and resolved with a single
// resolveRole(..., required: false) call — meaning whichever ids the model
// happened to return in accessoryIds (0 to 4 of them, per the schema)
// determined what showed up, with no fallback guarantee for watch/sunglasses
// specifically, even when the tier said they were required AND the closet
// had an eligible item.
//
// That gap is now closed by fillRequiredAccessorySlots (outfits.service.ts),
// which reuses the SAME canonical primitives already guaranteeing keyPieces
// (requiredSlotsForTier + fillMissingRequiredSlots) for watch/sunglasses too
// — not a new special-cased rule, just applying the existing shared
// "required slot, only if an eligible item exists, never fail generation
// otherwise" contract to the two slots that were incorrectly left out of it.
//
// Each test below is labeled (A) correct behavior that survived the fix
// unchanged, or (B) behavior the fix intentionally changed — updated in
// place to assert the new, correct behavior once the fix landed, with a
// comment noting what it asserted before.
//
// resolveClosetOnlyRecommendation/buildTierRoleShortlists/weatherGates were
// exported from outfits.service.ts (no behavior change on their own) so this
// file can unit-test the real resolution logic directly, without mocking the
// OpenAI call, DB, or profile/style-guide lookups this module also depends on.

function makeItem(overrides: {
  id: string;
  title: string;
  category: string;
  colorFamily?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  material?: string | null;
  brand?: string | null;
}): BuilderItem {
  return {
    colorFamily: null,
    formality: null,
    silhouette: null,
    season: null,
    material: null,
    brand: null,
    ...overrides,
  } as unknown as BuilderItem;
}

const WATCH = makeItem({ id: 'watch-1', title: 'Steel Watch', category: 'Watch', formality: 'Casual' });
const SUNGLASSES = makeItem({ id: 'sunglasses-1', title: 'Aviators', category: 'Sunglasses', formality: 'Casual' });
const FOOTWEAR = makeItem({ id: 'shoes-1', title: 'White Sneakers', category: 'Sneakers', formality: 'Casual' });
const BOTTOMS = makeItem({ id: 'bottoms-1', title: 'Chinos', category: 'Trousers', formality: 'Casual' });
const TOP = makeItem({ id: 'top-1', title: 'Tee', category: 'T-Shirt', formality: 'Casual' });
const BELT = makeItem({ id: 'belt-1', title: 'Brown Belt', category: 'Belt', formality: 'Casual' });

function baseRecommendation(overrides: Partial<ClosetOnlyOutfitRecommendation>): ClosetOnlyOutfitRecommendation {
  return {
    tier: 'casual',
    title: 'Weekend look',
    anchorItem: 'White sneakers',
    keyPieceIds: [BOTTOMS.id, TOP.id],
    shoeIds: [FOOTWEAR.id],
    accessoryIds: [],
    fitNotes: ['Relaxed fit', 'True to size'],
    whyItWorks: 'Simple and clean.',
    stylingDirection: 'Keep it casual.',
    detailNotes: ['Roll the sleeves', 'Tuck in the front'],
    ...overrides,
  };
}

function idSetsWith(accessories: string[]): TierRoleIdSets {
  return {
    keyPieces: new Set([BOTTOMS.id, TOP.id]),
    shoes: new Set([FOOTWEAR.id]),
    accessories: new Set(accessories),
  };
}

const ALL_ITEMS = [WATCH, SUNGLASSES, FOOTWEAR, BOTTOMS, TOP, BELT];
const itemsById = new Map(ALL_ITEMS.map((item) => [item.id, item]));

describe('resolveClosetOnlyRecommendation — watch/sunglasses accessory resolution (current behavior)', () => {
  it('(A, correct) includes watch when the closet has one AND the model chose its id', () => {
    const recommendation = baseRecommendation({ accessoryIds: [WATCH.id] });
    const idSets = idSetsWith([WATCH.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.accessories.map((piece) => piece.display_name)).toContain(WATCH.title);
  });

  it('(B, fixed) backfills watch when the closet has an eligible one, even though the model returned no accessoryIds', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] });
    const idSets = idSetsWith([WATCH.id]); // eligible watch exists in the shortlist
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    // Before the fix this asserted result.accessories.toHaveLength(0) — no
    // fallback guarantee for watch, unlike footwear (required: true) or
    // keyPieces (fillMissingRequiredSlots). fillRequiredAccessorySlots closes
    // that gap using the same canonical required-slot primitive.
    expect(result.accessories.map((piece) => piece.display_name)).toContain(WATCH.title);
  });

  it('(A, correct) omits watch without failing generation when the closet has none at all', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] });
    const idSets = idSetsWith([]); // no watch anywhere in this closet
    expect(() => resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS)).not.toThrow();
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.accessories).toHaveLength(0);
  });

  it('(B, fixed) backfills sunglasses when the closet has an eligible one, even though the model returned no accessoryIds', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] });
    const idSets = idSetsWith([SUNGLASSES.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    // Before the fix this asserted result.accessories.toHaveLength(0).
    expect(result.accessories.map((piece) => piece.display_name)).toContain(SUNGLASSES.title);
  });

  it('(A, correct) omits sunglasses without failing generation when the closet has none at all', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] });
    const idSets = idSetsWith([]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.accessories).toHaveLength(0);
  });

  it('(B, fixed) both watch and sunglasses are eligible — the model picking only one no longer drops the other', () => {
    const recommendation = baseRecommendation({ accessoryIds: [WATCH.id] }); // model chose watch only
    const idSets = idSetsWith([WATCH.id, SUNGLASSES.id]); // both were eligible
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    const names = result.accessories.map((piece) => piece.display_name);
    // Before the fix this asserted names.not.toContain(SUNGLASSES.title) —
    // eligible but silently absent, since both slots shared one unguaranteed bucket.
    expect(names).toContain(WATCH.title);
    expect(names).toContain(SUNGLASSES.title);
  });

  it('(A, correct) neither watch nor sunglasses available — generation still resolves, no throw, no forced pick', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] });
    const idSets = idSetsWith([]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.keyPieces.length).toBeGreaterThan(0);
    expect(result.shoes.length).toBeGreaterThan(0);
    expect(result.accessories).toHaveLength(0);
  });

  it('(A, correct) an omitted belt is NOT backfilled — only watch/sunglasses are guaranteed, Additional Accessories stay opt-in', () => {
    const recommendation = baseRecommendation({ accessoryIds: [] }); // model chose nothing at all
    const idSets = idSetsWith([BELT.id]); // an eligible belt exists but was never chosen
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.accessories.map((piece) => piece.display_name)).not.toContain(BELT.title);
  });

  it('(A, correct) Additional Accessories (belt/scarf/tie/socks) remain purely optional, alongside a backfilled watch', () => {
    const recommendation = baseRecommendation({ accessoryIds: [BELT.id] });
    const idSets = idSetsWith([BELT.id, WATCH.id]); // model only picked the belt; watch is separately guaranteed
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    const names = result.accessories.map((piece) => piece.display_name);
    // Before the fix this asserted names.not.toContain(WATCH.title) — same gap
    // as the dedicated watch/sunglasses tests above, not specific to belt/scarf/tie/socks.
    // The belt itself was never at risk either way — Additional Accessories were
    // never subject to the required-slot gap and aren't backfilled if omitted.
    expect(names).toContain(BELT.title);
    expect(names).toContain(WATCH.title);
  });

  it('(A, correct) footwear (required: true) DOES get a guaranteed fallback pick — contrast case showing the gap is specific to the accessories bucket', () => {
    const recommendation = baseRecommendation({ shoeIds: ['not-a-real-id'] }); // model's pick doesn't validate
    const idSets = idSetsWith([]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.shoes).toHaveLength(1); // falls back to the shortlist's first eligible item
    expect(result.shoes[0]?.display_name).toBe(FOOTWEAR.title);
  });
});

describe('buildTierRoleShortlists — accessory shortlisting (current behavior)', () => {
  const TIERS: TierSlug[] = ['casual', 'smart-casual', 'business'];

  it.each(TIERS)('(A, correct) shortlists an eligible watch and sunglasses for %s regardless of weather flags', (tier) => {
    const closetItems = [WATCH, SUNGLASSES, FOOTWEAR, BOTTOMS, TOP];
    const hot = buildTierRoleShortlists({
      closetItems, tier, includeThermalLayer: false, includeOuterwear: false, includeHat: false, includeBag: false,
    });
    const cold = buildTierRoleShortlists({
      closetItems, tier, includeThermalLayer: true, includeOuterwear: true, includeHat: false, includeBag: false,
    });
    expect(hot.idSets.accessories.has(WATCH.id)).toBe(true);
    expect(hot.idSets.accessories.has(SUNGLASSES.id)).toBe(true);
    // (B, incorrect by omission) weather has NO effect on sunglasses shortlisting today —
    // both "hot" and "cold" flag combinations shortlist sunglasses identically. Whether
    // sunglasses should be weather-gated at all is a product decision Part 3 does not
    // make on its own; this test only pins down that no such gating exists right now.
    expect(cold.idSets.accessories.has(SUNGLASSES.id)).toBe(hot.idSets.accessories.has(SUNGLASSES.id));
    expect(cold.idSets.accessories.has(WATCH.id)).toBe(hot.idSets.accessories.has(WATCH.id));
  });

  it.each(TIERS)('(A, correct) still shortlists sunglasses for %s even when its only item is formality-mismatched (degrades gracefully, never empty)', (tier) => {
    const mismatchedSunglasses = makeItem({ id: 'sunglasses-mismatch', title: 'Sport Sunglasses', category: 'Sunglasses', formality: 'Casual' });
    const closetItems = [mismatchedSunglasses, FOOTWEAR, BOTTOMS, TOP];
    const { idSets } = buildTierRoleShortlists({
      closetItems, tier, includeThermalLayer: false, includeOuterwear: false, includeHat: false, includeBag: false,
    });
    // business targets Formal (rank 3) vs a Casual (rank 0) sunglasses item — worst-case
    // mismatch — filterByFormalityBand still widens to the full candidate set rather than
    // excluding the slot entirely ("a slightly-off option beats none").
    expect(idSets.accessories.has(mismatchedSunglasses.id)).toBe(true);
  });

  it('(A, correct) hat/bag are excluded from the shortlist unless explicitly opted in', () => {
    const hat = makeItem({ id: 'hat-1', title: 'Baseball Cap', category: 'Hat', formality: 'Casual' });
    const bag = makeItem({ id: 'bag-1', title: 'Tote Bag', category: 'Bag', formality: 'Casual' });
    const closetItems = [hat, bag, FOOTWEAR, BOTTOMS, TOP];

    const optedOut = buildTierRoleShortlists({
      closetItems, tier: 'casual', includeThermalLayer: false, includeOuterwear: false, includeHat: false, includeBag: false,
    });
    expect(optedOut.idSets.accessories.has(hat.id)).toBe(false);
    expect(optedOut.idSets.accessories.has(bag.id)).toBe(false);

    const optedIn = buildTierRoleShortlists({
      closetItems, tier: 'casual', includeThermalLayer: false, includeOuterwear: false, includeHat: true, includeBag: true,
    });
    expect(optedIn.idSets.accessories.has(hat.id)).toBe(true);
    expect(optedIn.idSets.accessories.has(bag.id)).toBe(true);
  });
});

describe('weatherGates — what weather actually governs today', () => {
  it('(A, correct) only ever returns thermalLayer/outerwear flags — sunglasses/watch are not part of its output at all', () => {
    const result = weatherGates(5, 'casual');
    expect(Object.keys(result).sort()).toEqual(['includeOuterwear', 'includeThermalLayer']);
  });

  it('(A, correct) null temperature (unknown weather) defaults to including both thermal layer and outerwear', () => {
    expect(weatherGates(null, 'casual')).toEqual({ includeThermalLayer: true, includeOuterwear: true });
  });
});
