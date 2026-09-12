import { describe, expect, it } from 'vitest';

import { applyHatBagToggles, type BuilderClosetItem } from '../closet-outfit-builder.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R5B: characterizes applyHatBagToggles — the hat/bag ON/OFF toggle
// orchestration previously duplicated verbatim in closet-outfits.service.ts's
// updateOutfitAccessories and trips.service.ts's updateDayAccessories (R4
// flagged this pair as GREEN — near-byte-identical). This file protects the
// exact behavior of the extracted shared function; the surrounding
// engine-specific wrappers (tier/targetFormalityRank derivation, DB loading,
// feedback-row/sketch-job vs. DTO-mapping output shape) are untouched and
// remain each engine's own responsibility, not part of this shared function.
//
// This is characterization only — the extraction was a verified line-by-line
// identical move (see R5B's final report), not a rewrite. No production
// behavior changed.

function makeItem(overrides: { id: string; title: string; category: string; formality?: string | null }): BuilderClosetItem {
  return { formality: null, ...overrides };
}

const HAT = makeItem({ id: 'hat-1', title: 'Cap', category: 'Hat', formality: 'Casual' });
const BAG = makeItem({ id: 'bag-1', title: 'Tote', category: 'Bag', formality: 'Casual' });
const TROUSERS = makeItem({ id: 'trousers-1', title: 'Chinos', category: 'Trousers', formality: 'Casual' });
const TOP = makeItem({ id: 'top-1', title: 'Tee', category: 'T-Shirt', formality: 'Casual' });
const FOOTWEAR = makeItem({ id: 'shoes-1', title: 'Sneakers', category: 'Sneakers', formality: 'Casual' });

const ALL_ITEMS = [HAT, BAG, TROUSERS, TOP, FOOTWEAR];
const itemsById = new Map(ALL_ITEMS.map((item) => [item.id, item]));

function call(params: { itemIds: string[]; closetItems: BuilderClosetItem[]; includeHat: boolean; includeBag: boolean }) {
  return applyHatBagToggles({
    itemIds: params.itemIds,
    itemsById,
    closetItems: params.closetItems,
    tier: 'casual',
    targetFormalityRank: 0,
    includeHat: params.includeHat,
    includeBag: params.includeBag,
  });
}

describe('applyHatBagToggles', () => {
  it('hat present + toggled off → removes the hat, leaves everything else untouched', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id],
      closetItems: ALL_ITEMS,
      includeHat: false,
      includeBag: false,
    });
    expect(result).not.toContain(HAT.id);
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id]));
  });

  it('hat absent + toggled on → adds one via pickAccessory, leaves everything else untouched', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id],
      closetItems: ALL_ITEMS,
      includeHat: true,
      includeBag: false,
    });
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id]));
  });

  it('bag present + toggled off → removes the bag, leaves everything else untouched', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id, BAG.id],
      closetItems: ALL_ITEMS,
      includeHat: false,
      includeBag: false,
    });
    expect(result).not.toContain(BAG.id);
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id]));
  });

  it('bag absent + toggled on → adds one via pickAccessory, leaves everything else untouched', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id],
      closetItems: ALL_ITEMS,
      includeHat: false,
      includeBag: true,
    });
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id, BAG.id]));
  });

  it('hat already present + toggled on → left exactly as-is, never re-picked or duplicated', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id],
      closetItems: ALL_ITEMS,
      includeHat: true,
      includeBag: false,
    });
    expect(result.filter((id) => id === HAT.id)).toHaveLength(1);
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id]));
  });

  it('hat absent + toggled off → remains absent (no-op)', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id],
      closetItems: ALL_ITEMS,
      includeHat: false,
      includeBag: false,
    });
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id]));
  });

  it('both toggles handled correctly in the same call — hat added, bag removed', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id, BAG.id],
      closetItems: ALL_ITEMS,
      includeHat: true,
      includeBag: false,
    });
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id]));
  });

  it('unrelated slots (bottoms/top/footwear) are never altered by any hat/bag toggle combination', () => {
    const combinations: [boolean, boolean][] = [[true, true], [true, false], [false, true], [false, false]];
    for (const [includeHat, includeBag] of combinations) {
      const result = call({ itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id], closetItems: ALL_ITEMS, includeHat, includeBag });
      expect(result).toContain(TROUSERS.id);
      expect(result).toContain(TOP.id);
      expect(result).toContain(FOOTWEAR.id);
    }
  });

  it('when toggled on but the closet has no eligible hat/bag at all, pickAccessory returns null and the item is simply not added (no throw)', () => {
    const result = call({
      itemIds: [TROUSERS.id, TOP.id, FOOTWEAR.id],
      closetItems: [TROUSERS, TOP, FOOTWEAR], // no hat/bag in this closet
      includeHat: true,
      includeBag: true,
    });
    expect(new Set(result)).toEqual(new Set([TROUSERS.id, TOP.id, FOOTWEAR.id]));
  });
});
