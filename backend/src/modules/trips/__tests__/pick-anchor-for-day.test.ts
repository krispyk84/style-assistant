import { describe, expect, it } from 'vitest';

import { pickAnchorForDay, type BuilderItem } from '../trips.service.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// A user reported that in the Trip Planner's "From My Closet" mode, a
// closet-sourced anchor ("definitely bring" this coat/these sneakers) would
// appear once on the trip's first eligible day and then never again, even
// on trips many days longer than the number of anchors selected.
//
// Root cause: usedAnchorItemIds is recomputed by the frontend on every
// per-day generation request by scanning every closet item id used across
// ALL previously generated days (collectUsedAnchorItemIds in
// app/trip-results-mappers.ts) — it only ever grows, never resets. Once
// every anchor id appears somewhere in that set, pickAnchorForDay's `unused`
// list permanently empties out.
//
// pickAnchorForDay/BuilderItem are exported from trips.service.ts (no
// behavior change on their own) so this file can unit-test the real
// selection logic directly, without mocking the OpenAI call, DB, or
// closet-index lookups the rest of the module depends on.

function makeItem(overrides: { id: string; formality?: string | null }): BuilderItem {
  return { formality: null, ...overrides } as unknown as BuilderItem;
}

const CASUAL_SNEAKERS = makeItem({ id: 'sneakers-1', formality: 'Casual' });
const FORMAL_COAT = makeItem({ id: 'coat-1', formality: 'Formal' });
const CASUAL_JACKET = makeItem({ id: 'jacket-1', formality: 'Casual' });

describe('pickAnchorForDay', () => {
  it('returns null when there are no anchors', () => {
    const result = pickAnchorForDay({
      dayIndex: 0,
      targetFormalityRank: 0,
      closetAnchorItems: [],
      usedAnchorItemIds: new Set(),
    });

    expect(result).toBeNull();
  });

  it('picks the unused anchor whose formality is closest to the target', () => {
    const result = pickAnchorForDay({
      dayIndex: 0,
      targetFormalityRank: 0, // Casual
      closetAnchorItems: [FORMAL_COAT, CASUAL_SNEAKERS],
      usedAnchorItemIds: new Set(),
    });

    expect(result?.id).toBe(CASUAL_SNEAKERS.id);
  });

  it('skips already-used anchors in favor of a still-unused one', () => {
    const result = pickAnchorForDay({
      dayIndex: 1,
      targetFormalityRank: 0,
      closetAnchorItems: [CASUAL_SNEAKERS, CASUAL_JACKET],
      usedAnchorItemIds: new Set([CASUAL_SNEAKERS.id]),
    });

    expect(result?.id).toBe(CASUAL_JACKET.id);
  });

  it('returns null when the only unused anchor is formality-implausible for this day', () => {
    const result = pickAnchorForDay({
      dayIndex: 0,
      targetFormalityRank: 0, // Casual — Formal is 3 ranks away, beyond tolerance
      closetAnchorItems: [FORMAL_COAT],
      usedAnchorItemIds: new Set(),
    });

    expect(result).toBeNull();
  });

  // ── The actual bug: an anchor used once, then permanently excluded ───────
  describe('once every anchor has appeared somewhere in the trip (unused is empty)', () => {
    it('cycles back through the full anchor list instead of returning null', () => {
      const usedAnchorItemIds = new Set([CASUAL_SNEAKERS.id, CASUAL_JACKET.id]);

      const result = pickAnchorForDay({
        dayIndex: 2,
        targetFormalityRank: 0,
        closetAnchorItems: [CASUAL_SNEAKERS, CASUAL_JACKET],
        usedAnchorItemIds,
      });

      // Before the fix this was always null from this point in the trip
      // onward, however many days remained.
      expect(result).not.toBeNull();
    });

    it('rotates which anchor gets picked by day index, so a multi-anchor trip fairly cycles instead of always repicking the single closest-formality match', () => {
      const usedAnchorItemIds = new Set([CASUAL_SNEAKERS.id, CASUAL_JACKET.id]);
      const closetAnchorItems = [CASUAL_SNEAKERS, CASUAL_JACKET];

      const day2 = pickAnchorForDay({ dayIndex: 2, targetFormalityRank: 0, closetAnchorItems, usedAnchorItemIds });
      const day3 = pickAnchorForDay({ dayIndex: 3, targetFormalityRank: 0, closetAnchorItems, usedAnchorItemIds });

      expect(day2?.id).toBe(closetAnchorItems[2 % closetAnchorItems.length]!.id);
      expect(day3?.id).toBe(closetAnchorItems[3 % closetAnchorItems.length]!.id);
      expect(day2?.id).not.toBe(day3?.id);
    });

    it("falls through to the closest-formality match over the full list when this day's rotated pick doesn't suit the day, rather than skipping the anchor entirely", () => {
      // dayIndex 0 rotates to FORMAL_COAT (index 0), which is implausible for
      // a Casual day — should fall through to CASUAL_SNEAKERS, not return null.
      const usedAnchorItemIds = new Set([FORMAL_COAT.id, CASUAL_SNEAKERS.id]);

      const result = pickAnchorForDay({
        dayIndex: 0,
        targetFormalityRank: 0,
        closetAnchorItems: [FORMAL_COAT, CASUAL_SNEAKERS],
        usedAnchorItemIds,
      });

      expect(result?.id).toBe(CASUAL_SNEAKERS.id);
    });

    it('still returns null when EVERY anchor is formality-implausible for this day, even while cycling', () => {
      const secondFormalItem = makeItem({ id: 'formal-2', formality: 'Formal' });
      const usedAnchorItemIds = new Set([FORMAL_COAT.id, secondFormalItem.id]);

      const result = pickAnchorForDay({
        dayIndex: 0,
        targetFormalityRank: 0, // Casual — nothing on this trip's anchor list fits
        closetAnchorItems: [FORMAL_COAT, secondFormalItem],
        usedAnchorItemIds,
      });

      expect(result).toBeNull();
    });
  });
});
