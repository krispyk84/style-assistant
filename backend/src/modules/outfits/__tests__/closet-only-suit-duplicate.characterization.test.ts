import { describe, expect, it } from 'vitest';

import {
  resolveClosetOnlyRecommendation,
  type BuilderItem,
  type TierRoleIdSets,
} from '../outfits.service.js';
import type { ClosetOnlyOutfitRecommendation } from '../outfits.schemas.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R4: characterizes how THIS engine (outfits.service.ts's closet-only
// path) handles two different real items competing for the same outfit
// SLOT — the "duplicate/collision" family of rules the R4 audit flagged as
// having drifted across the three closet-only generation engines.
//
// This engine's schema is structurally different from the other two: model
// output is a flat keyPieceIds ARRAY (no per-slot key), so "two items compete
// for one slot" is the only way a collision can even arise here — there is no
// slot-keyed chosenIds map to duplicate an id across the way closet-outfits.
// service.ts's resolveChoiceOutfits or trips.service.ts's chooseFullClosetDay/
// generateDayVariants work. normalizeKeyPieceRoles (outfits.service.ts,
// private) resolves a collision by FIRST-WINS, with one exception: a suit
// item beats an already-placed non-suit item for the same slot. There is NO
// outfit-level rejection here — unlike closet-outfits.service.ts's
// resolveChoiceOutfits, which rejects the WHOLE outfit if a non-suit id ends
// up duplicated across two slots. This is a real, verified difference (not
// assumed from the original audit) — see the R4 final report's rule-ownership
// matrix for the full 3-way comparison this file's findings feed into.
//
// This is characterization only — documenting CURRENT behavior, not
// asserting it's correct. No production behavior was changed.

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

const TROUSERS_A = makeItem({ id: 'trousers-a', title: 'Chinos', category: 'Trousers', formality: 'Casual' });
const TROUSERS_B = makeItem({ id: 'trousers-b', title: 'Wool Trousers', category: 'Trousers', formality: 'Casual' });
const SUIT = makeItem({ id: 'suit-1', title: 'Navy Suit', category: 'Suit', formality: 'Formal' });
const TOP = makeItem({ id: 'top-1', title: 'Tee', category: 'T-Shirt', formality: 'Casual' });
const FOOTWEAR = makeItem({ id: 'shoes-1', title: 'White Sneakers', category: 'Sneakers', formality: 'Casual' });

const ALL_ITEMS = [TROUSERS_A, TROUSERS_B, SUIT, TOP, FOOTWEAR];
const itemsById = new Map(ALL_ITEMS.map((item) => [item.id, item]));

function baseRecommendation(overrides: Partial<ClosetOnlyOutfitRecommendation>): ClosetOnlyOutfitRecommendation {
  return {
    tier: 'smart-casual',
    title: 'Look',
    anchorItem: 'Chinos',
    keyPieceIds: [],
    shoeIds: [FOOTWEAR.id],
    accessoryIds: [],
    fitNotes: [],
    whyItWorks: '',
    stylingDirection: '',
    detailNotes: [],
    ...overrides,
  };
}

function idSetsWith(keyPieces: string[]): TierRoleIdSets {
  return {
    keyPieces: new Set(keyPieces),
    shoes: new Set([FOOTWEAR.id]),
    accessories: new Set(),
  };
}

describe('resolveClosetOnlyRecommendation — two different (non-suit) items competing for the same slot', () => {
  it('the FIRST item the model listed for a slot wins; a later competing pick for the same slot is silently dropped entirely — no error, no fallback, no partial substitution', () => {
    // Both TROUSERS_A and TROUSERS_B resolve to the same 'bottoms' slot.
    const recommendation = baseRecommendation({ keyPieceIds: [TROUSERS_A.id, TROUSERS_B.id, TOP.id] });
    const idSets = idSetsWith([TROUSERS_A.id, TROUSERS_B.id, TOP.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    const ids = result.closetItemIds;
    expect(ids).toContain(TROUSERS_A.id);
    expect(ids).not.toContain(TROUSERS_B.id); // silently dropped — never appears anywhere in the resolved outfit
  });

  it('listing them in the opposite order flips which one wins — confirms the rule is "first in keyPieceIds", not any deeper preference', () => {
    const recommendation = baseRecommendation({ keyPieceIds: [TROUSERS_B.id, TROUSERS_A.id, TOP.id] });
    const idSets = idSetsWith([TROUSERS_A.id, TROUSERS_B.id, TOP.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.closetItemIds).toContain(TROUSERS_B.id);
    expect(result.closetItemIds).not.toContain(TROUSERS_A.id);
  });
});

describe('resolveClosetOnlyRecommendation — a suit beats an already-placed non-suit competitor for the same slot', () => {
  it('a suit listed AFTER a plain pair of trousers overrides it for bottoms, and is also promoted into secondaryTop (suit dual-role) — the plain trousers are dropped entirely, even though nothing else was ever offered for secondaryTop', () => {
    const recommendation = baseRecommendation({ keyPieceIds: [TROUSERS_A.id, SUIT.id, TOP.id] });
    const idSets = idSetsWith([TROUSERS_A.id, SUIT.id, TOP.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    const ids = result.closetItemIds ?? [];
    expect(ids).toContain(SUIT.id);
    expect(ids).not.toContain(TROUSERS_A.id);
    // The suit shows up once (deduped) despite structurally filling two slots.
    expect(ids.filter((id) => id === SUIT.id)).toHaveLength(1);
  });

  it('a suit listed BEFORE a plain pair of trousers still wins for bottoms — suit priority is not just "whoever is first"', () => {
    const recommendation = baseRecommendation({ keyPieceIds: [SUIT.id, TROUSERS_A.id, TOP.id] });
    const idSets = idSetsWith([TROUSERS_A.id, SUIT.id, TOP.id]);
    const result = resolveClosetOnlyRecommendation(recommendation, idSets, itemsById, ALL_ITEMS);
    expect(result.closetItemIds).toContain(SUIT.id);
    expect(result.closetItemIds).not.toContain(TROUSERS_A.id);
  });
});

// ── Blocked characterization — documented, not force-tested ─────────────────
//
// The other two engines' equivalent collision-handling logic
// (closet-outfits.service.ts's resolveChoiceOutfits, and trips.service.ts's
// chooseFullClosetDay / generateDayVariants) is NOT exported from their
// modules — only the *Service objects are exported, and R4 is explicitly
// characterization-only (no production file changes, not even a trivial
// export). Verified directly against current HEAD (not assumed from the
// original audit):
//
//   - closet-outfits.service.ts's resolveChoiceOutfits (private, lines ~193-255):
//     reconciles a shared suit id across bottoms/secondaryTop the same way
//     normalizeSuitDualRole does, but for any OTHER id duplicated across two
//     slots, REJECTS THE ENTIRE OUTFIT (`if (hasIllegitimateDuplicate) continue;`)
//     rather than silently dropping the loser the way this engine does.
//
//   - trips.service.ts's chooseFullClosetDay (private, lines ~383-551) builds
//     bySlot directly from the model's per-slot chosenIds and calls
//     normalizeSuitDualRole with NO illegitimate-duplicate check at all — a
//     non-suit id duplicated across two slots would silently pass through
//     (invisible in the final deduped display list via dedupeById, but
//     structurally different from both other engines' handling).
//
//   - trips.service.ts's generateDayVariants (private, lines ~818-920) takes
//     a THIRD stance: rejects a variant if its chosen swap ids contain ANY
//     duplicate at all (`if (new Set(swapIds).size !== swapIds.length) continue;`),
//     with NO suit exception — this is the one case that could reject a
//     legitimately correct suit-into-two-slots variant outright.
//
// Recommended first action for R5: export these three (or the minimal pure
// duplicate-resolution kernel of each) as a trivial, no-behavior-change
// visibility change — mirroring exactly how resolveClosetOnlyRecommendation
// and buildTierRoleShortlists were exported for this same purpose — then add
// real differential tests here proving the 3-way (in this file, 4-way
// including this engine's own first-wins-unless-suit rule) divergence with
// real assertions instead of this comment.
