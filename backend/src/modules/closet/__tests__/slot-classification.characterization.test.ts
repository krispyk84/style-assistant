import { describe, expect, it } from 'vitest';

import { classifyItemsBySlot, type BuilderClosetItem } from '../closet-outfit-builder.js';
import type { OutfitSlot } from '../closet-taxonomy.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R5C: characterizes the now-consolidated classifyItemsBySlot —
// previously duplicated verbatim as classifyItemsBySlot (closet-outfits.
// service.ts) and buildBySlotFromItemIds (trips.service.ts). Before
// consolidating, R5C empirically proved both prior implementations produced
// identical output across every fixture below (8/8 differential assertions,
// including the ordering-sensitive same-slot-collision case) by temporarily
// exporting both and running them side by side — see the R5C final report
// for that proof. Once confirmed GREEN, both local copies were deleted in
// favor of this one shared function, and this file now protects its
// behavior directly instead of via differential comparison.
//
// This function is a DISPLAY-reconstruction step only — every current caller
// (resolveChoiceOutfits, generateDayVariants, and both hat/bag accessory-
// toggle endpoints) already guarantees at most one non-suit item per slot
// BEFORE calling this; it does not itself decide which item wins a slot. The
// "two items compete for the same slot" test below documents the function's
// own (currently unreachable via any real caller) last-wins fallback
// behavior — not a policy this function or R5C endorses.

function makeItem(overrides: { id: string; title: string; category: string; formality?: string | null }): BuilderClosetItem {
  return { formality: null, ...overrides };
}

const TROUSERS = makeItem({ id: 'trousers-1', title: 'Chinos', category: 'Trousers' });
const TROUSERS_B = makeItem({ id: 'trousers-2', title: 'Wool Trousers', category: 'Trousers' });
const TOP = makeItem({ id: 'top-1', title: 'Tee', category: 'T-Shirt' });
const FOOTWEAR = makeItem({ id: 'shoes-1', title: 'Sneakers', category: 'Sneakers' });
const SUIT = makeItem({ id: 'suit-1', title: 'Navy Suit', category: 'Suit' });
const JACKET = makeItem({ id: 'jacket-1', title: 'Field Jacket', category: 'Jacket' });
const HAT = makeItem({ id: 'hat-1', title: 'Cap', category: 'Hat' });
const BELT = makeItem({ id: 'belt-1', title: 'Belt', category: 'Belt' });
const WATCH = makeItem({ id: 'watch-1', title: 'Watch', category: 'Watch' });

const ALL_ITEMS = [TROUSERS, TROUSERS_B, TOP, FOOTWEAR, SUIT, JACKET, HAT, BELT, WATCH];
const itemsById = new Map(ALL_ITEMS.map((item) => [item.id, item]));

function slotIds(bySlot: Partial<Record<OutfitSlot, BuilderClosetItem>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, item] of Object.entries(bySlot)) out[slot] = item!.id;
  return out;
}

describe('classifyItemsBySlot', () => {
  it('simple top + bottom + footwear classify into their respective slots, no accessories', () => {
    const result = classifyItemsBySlot([TROUSERS.id, TOP.id, FOOTWEAR.id], itemsById);
    expect(slotIds(result.bySlot)).toEqual({ bottoms: TROUSERS.id, primaryTop: TOP.id, footwear: FOOTWEAR.id });
    expect(result.accessoryItems).toEqual([]);
  });

  it('a single suit id is promoted into BOTH bottoms and secondaryTop (suit dual-role)', () => {
    const result = classifyItemsBySlot([SUIT.id, TOP.id, FOOTWEAR.id], itemsById);
    expect(slotIds(result.bySlot)).toEqual({ bottoms: SUIT.id, secondaryTop: SUIT.id, primaryTop: TOP.id, footwear: FOOTWEAR.id });
  });

  it('outerwear classifies into the outerwear slot', () => {
    const result = classifyItemsBySlot([TROUSERS.id, TOP.id, FOOTWEAR.id, JACKET.id], itemsById);
    expect(result.bySlot.outerwear?.id).toBe(JACKET.id);
  });

  it('hat and watch land in their own single-item slots; belt (a multi-pick "Additional Accessories" group) lands in accessoryItems instead', () => {
    const result = classifyItemsBySlot([TROUSERS.id, TOP.id, FOOTWEAR.id, HAT.id, BELT.id, WATCH.id], itemsById);
    expect(result.bySlot.hat?.id).toBe(HAT.id);
    expect(result.bySlot.watch?.id).toBe(WATCH.id);
    expect(result.accessoryItems.map((i) => i.id)).toEqual([BELT.id]);
  });

  it('a duplicate itemId (the same id listed twice) is simply assigned to its slot twice — no error, no duplicate accessory entry', () => {
    const result = classifyItemsBySlot([TROUSERS.id, TROUSERS.id, TOP.id, FOOTWEAR.id], itemsById);
    expect(result.bySlot.bottoms?.id).toBe(TROUSERS.id);
  });

  it('an unknown/missing item id (not present in itemsById) is silently skipped, no throw', () => {
    const result = classifyItemsBySlot([TROUSERS.id, 'does-not-exist', TOP.id, FOOTWEAR.id], itemsById);
    expect(Object.keys(result.bySlot)).toHaveLength(3);
  });

  it('two DIFFERENT non-suit items competing for the same slot: the LAST one in iteration order silently wins — documents current behavior, not a policy this function decides on behalf of any RED-classified caller', () => {
    const forward = classifyItemsBySlot([TROUSERS.id, TROUSERS_B.id, TOP.id], itemsById);
    expect(forward.bySlot.bottoms?.id).toBe(TROUSERS_B.id);

    const reversed = classifyItemsBySlot([TROUSERS_B.id, TROUSERS.id, TOP.id], itemsById);
    expect(reversed.bySlot.bottoms?.id).toBe(TROUSERS.id);
  });

  it('empty input returns an empty bySlot and empty accessoryItems', () => {
    const result = classifyItemsBySlot([], itemsById);
    expect(result.bySlot).toEqual({});
    expect(result.accessoryItems).toEqual([]);
  });
});
