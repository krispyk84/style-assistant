import { CATEGORY_TO_GROUP, FORMALITY_RANK, SLOT_GROUPS, type OutfitSlot } from './closet-taxonomy.js';

/**
 * Shared closet-only outfit-building primitives — used by Generate 5
 * Outfits, the trip planner's From My Closet mode, and Create a Look's
 * closet-only path.
 *
 * The main selection primitive is `buildOutfitSlotShortlists`: it filters
 * each slot (footwear, bottoms, tops, ...) down to real closet items within
 * the target formality band, but does NOT pick a winner — it hands back a
 * generously-sized, per-slot candidate list. The caller then puts those
 * shortlists in front of an LLM (alongside color/texture/silhouette/vibe/
 * trendiness context) and asks it to CHOOSE and narrate a coherent outfit
 * from real ids only. This is what actually fixes formality mismatches
 * (a business-formality shortlist structurally cannot contain sneakers when
 * the closet has dress shoes) and phantom pieces (every id is real and
 * slot-correct by construction) while keeping the model's styling judgment
 * intact — a shortlist is a guardrail, not a substitute for taste.
 *
 * `buildDeterministicOutfit` (pure code, no LLM) is kept for the narrower
 * "add a hat/bag to an already-composed outfit" toggle, where a single,
 * low-stakes addition doesn't warrant its own LLM round-trip.
 */

export type BuilderClosetItem = {
  id: string;
  title: string;
  category: string;
  formality?: string | null;
};

export type DeterministicOutfitParams<TItem extends BuilderClosetItem> = {
  closetItems: TItem[];
  /** Target FORMALITY_RANK value (0-3) for this outfit. */
  targetFormalityRank: number;
  /** Weather-gated — caller decides based on temperature. */
  includeLayering: boolean;
  includeOuterwear: boolean;
  includeHat?: boolean;
  includeBag?: boolean;
  /** Item ids to never pick (already used elsewhere in this batch, or must stay untouched). */
  excludeItemIds?: ReadonlySet<string>;
  /** Garment groups recently used per slot — deprioritized (not excluded) for type diversity. */
  recentGroupsBySlot?: Partial<Record<OutfitSlot, ReadonlySet<string>>>;
};

export type DeterministicOutfitResult<TItem extends BuilderClosetItem> = {
  itemIds: string[];
  bySlot: Partial<Record<OutfitSlot, TItem>>;
};

function formalityDistance(item: BuilderClosetItem, targetRank: number): number {
  const rank = item.formality ? FORMALITY_RANK[item.formality] : undefined;
  // Unknown formality isn't disqualifying — treat as a medium distance so a
  // well-fitting but uncatalogued item can still be picked over nothing.
  if (rank === undefined) return 2;
  return Math.abs(rank - targetRank);
}

function pickForSlot<TItem extends BuilderClosetItem>(
  slot: OutfitSlot,
  closetItems: TItem[],
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string>,
  recentGroups: ReadonlySet<string>,
): TItem | null {
  const allowedGroups = SLOT_GROUPS[slot];
  const candidates = closetItems.filter((item) => {
    if (excludeItemIds.has(item.id)) return false;
    const group = CATEGORY_TO_GROUP[item.category];
    return group !== undefined && allowedGroups.includes(group);
  });
  if (candidates.length === 0) return null;

  // Formality band: prefer items within 1 rank of the target; widen to all
  // candidates only if nothing qualifies (better a slightly-off item than none).
  const withinBand = candidates.filter((item) => formalityDistance(item, targetFormalityRank) <= 1);
  const pool = withinBand.length > 0 ? withinBand : candidates;

  // Weighted random favoring garment groups not recently used in this slot,
  // so footwear (for example) doesn't always land on the same shoe type.
  const weighted = pool.map((item) => {
    const group = CATEGORY_TO_GROUP[item.category]!;
    return { item, weight: recentGroups.has(group) ? 1 : 4 };
  });
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { item, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return weighted[weighted.length - 1]!.item;
}

export function buildDeterministicOutfit<TItem extends BuilderClosetItem>(
  params: DeterministicOutfitParams<TItem>,
): DeterministicOutfitResult<TItem> {
  const excludeItemIds = new Set(params.excludeItemIds ?? []);
  const bySlot: Partial<Record<OutfitSlot, TItem>> = {};

  const slotsToFill: OutfitSlot[] = ['footwear', 'bottoms', 'tops', 'watch', 'sunglasses'];
  if (params.includeLayering) slotsToFill.push('layering');
  if (params.includeOuterwear) slotsToFill.push('outerwear');
  if (params.includeHat) slotsToFill.push('hat');
  if (params.includeBag) slotsToFill.push('bag');

  for (const slot of slotsToFill) {
    const recentGroups = params.recentGroupsBySlot?.[slot] ?? new Set<string>();
    const picked = pickForSlot(slot, params.closetItems, params.targetFormalityRank, excludeItemIds, recentGroups);
    if (picked) {
      bySlot[slot] = picked;
      excludeItemIds.add(picked.id);
    }
  }

  return {
    itemIds: Object.values(bySlot).map((item) => (item as TItem).id),
    bySlot,
  };
}

export type SlotShortlists<TItem> = Partial<Record<OutfitSlot, TItem[]>>;

// Safety valve for pathologically large closets — NOT a quality cap. The
// point of this design is that the model gets real variety to reason about;
// don't shrink this to "save tokens" without cause.
const DEFAULT_MAX_PER_SLOT = 40;

export type SlotShortlistParams<TItem extends BuilderClosetItem> = {
  closetItems: TItem[];
  /** Target FORMALITY_RANK value (0-3) for this outfit/day/tier. */
  targetFormalityRank: number;
  /** Weather-gated — caller decides based on temperature. */
  includeLayering: boolean;
  includeOuterwear: boolean;
  includeHat?: boolean;
  includeBag?: boolean;
  /** Item ids to omit entirely (e.g. already fixed elsewhere, like an anchor). */
  excludeItemIds?: ReadonlySet<string>;
  maxPerSlot?: number;
};

/**
 * Builds a generous, formality-filtered candidate list per slot — the
 * shortlist an LLM chooses from, not a single deterministic pick. Widens to
 * the full candidate set for a slot if nothing qualifies within the target
 * formality band (a slightly-off option beats none), matching the same
 * graceful-degradation behavior as buildDeterministicOutfit.
 */
export function buildOutfitSlotShortlists<TItem extends BuilderClosetItem>(
  params: SlotShortlistParams<TItem>,
): SlotShortlists<TItem> {
  const excludeItemIds = params.excludeItemIds ?? new Set<string>();
  const maxPerSlot = params.maxPerSlot ?? DEFAULT_MAX_PER_SLOT;

  const slotsToInclude: OutfitSlot[] = ['footwear', 'bottoms', 'tops', 'watch', 'sunglasses'];
  if (params.includeLayering) slotsToInclude.push('layering');
  if (params.includeOuterwear) slotsToInclude.push('outerwear');
  if (params.includeHat) slotsToInclude.push('hat');
  if (params.includeBag) slotsToInclude.push('bag');

  const bySlot: SlotShortlists<TItem> = {};

  for (const slot of slotsToInclude) {
    const allowedGroups = SLOT_GROUPS[slot];
    const candidates = params.closetItems.filter((item) => {
      if (excludeItemIds.has(item.id)) return false;
      const group = CATEGORY_TO_GROUP[item.category];
      return group !== undefined && allowedGroups.includes(group);
    });
    if (candidates.length === 0) continue;

    const withinBand = candidates.filter((item) => formalityDistance(item, params.targetFormalityRank) <= 1);
    const pool = withinBand.length > 0 ? withinBand : candidates;

    // Shuffle so a long shortlist doesn't always present the same items in
    // the same position — models can anchor on list order.
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    bySlot[slot] = shuffled.slice(0, maxPerSlot);
  }

  return bySlot;
}

/**
 * Same shortlist philosophy, scoped to a single swap: every candidate in the
 * SAME garment group as the item being replaced (never a different slot),
 * within the formality band — so a shoe swap only ever offers other shoes,
 * and the LLM picks a genuinely different, thoughtfully-coordinated
 * replacement rather than a random one.
 */
export function buildVariantCandidates<TItem extends BuilderClosetItem>(
  originalItem: TItem,
  closetItems: TItem[],
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string>,
  maxCandidates: number = DEFAULT_MAX_PER_SLOT,
): TItem[] {
  const group = CATEGORY_TO_GROUP[originalItem.category];
  if (!group) return [];

  const candidates = closetItems.filter((item) => {
    if (excludeItemIds.has(item.id) || item.id === originalItem.id) return false;
    return CATEGORY_TO_GROUP[item.category] === group;
  });
  if (candidates.length === 0) return [];

  const withinBand = candidates.filter((item) => formalityDistance(item, targetFormalityRank) <= 1);
  const pool = withinBand.length > 0 ? withinBand : candidates;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxCandidates);
}
