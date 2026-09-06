import {
  ACCESSORY_GROUPS,
  CATEGORY_TO_GROUP,
  FORMALITY_RANK,
  SLOT_GROUPS,
  TIER_ALLOWS_SUIT,
  TIER_SLOT_RULES,
  type OutfitSlot,
  type TierSlug,
} from './closet-taxonomy.js';

/**
 * Shared closet-only outfit-building primitives — used by Generate 5
 * Outfits, the trip planner's From My Closet mode, and Create a Look's
 * closet-only path.
 *
 * The main selection primitive is `buildOutfitSlotShortlists`: it filters
 * each slot (footwear, bottoms, primaryTop, ...) down to real closet items
 * within the target formality band AND the tier's hard-enforced garment-
 * group restrictions (closet-taxonomy.ts's TIER_SLOT_RULES — e.g. business
 * footwear structurally cannot include sneakers), but does NOT pick a
 * winner — it hands back a generously-sized, per-slot candidate list. The
 * caller then puts those shortlists in front of an LLM (alongside color/
 * texture/silhouette/vibe/trendiness context) and asks it to CHOOSE and
 * narrate a coherent outfit from real ids only. This is what actually fixes
 * formality mismatches and phantom pieces while keeping the model's styling
 * judgment intact for WHICH real, already-tier-legal item to wear — a
 * shortlist is a guardrail, not a substitute for taste.
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
  tier: TierSlug;
  /** Weather-gated — caller decides based on temperature. */
  includeThermalLayer: boolean;
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

/**
 * Narrows to the tightest formality band that isn't empty: exact match
 * first, widening to ±1 rank, then to the full candidate set only as a last
 * resort. Trying ±1 first (the old behavior) let an adjacent-formality item
 * (e.g. a Smart-Casual blazer) win a slot even when the closet had plenty of
 * exact-formality options — visible as a "relaxed" day getting a linen sports
 * jacket. Exact-first keeps the model's shortlist honestly matched to the
 * requested formality whenever the wardrobe supports it.
 */
export function filterByFormalityBand<TItem extends BuilderClosetItem>(candidates: TItem[], targetRank: number): TItem[] {
  const exact = candidates.filter((item) => formalityDistance(item, targetRank) === 0);
  if (exact.length > 0) return exact;
  const withinOne = candidates.filter((item) => formalityDistance(item, targetRank) <= 1);
  if (withinOne.length > 0) return withinOne;
  return candidates;
}

/**
 * Resolves which garment groups a slot may draw from for a given tier —
 * TIER_SLOT_RULES' hard restriction when one is set (e.g. business
 * footwear → dress shoes/loafers only), otherwise the slot's full
 * SLOT_GROUPS membership. A suit is added back in as a valid candidate for
 * bottoms/secondaryTop whenever the tier allows the suit dual-role, since
 * TIER_SLOT_RULES' allowedGroups lists are expressed in terms of the
 * separates path and shouldn't need to repeat "or a suit" every time.
 */
export function effectiveAllowedGroups(slot: OutfitSlot, tier: TierSlug): readonly string[] {
  const rule = TIER_SLOT_RULES[tier][slot];
  const base = (rule?.allowedGroups ?? SLOT_GROUPS[slot]).filter((group) => group !== 'suit');
  if (TIER_ALLOWS_SUIT[tier] && SLOT_GROUPS[slot].includes('suit')) {
    return [...base, 'suit'];
  }
  return base;
}

function pickForSlot<TItem extends BuilderClosetItem>(
  slot: OutfitSlot,
  closetItems: TItem[],
  tier: TierSlug,
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string>,
  recentGroups: ReadonlySet<string>,
): TItem | null {
  const allowedGroups = effectiveAllowedGroups(slot, tier);
  const candidates = closetItems.filter((item) => {
    if (excludeItemIds.has(item.id)) return false;
    const group = CATEGORY_TO_GROUP[item.category];
    return group !== undefined && allowedGroups.includes(group);
  });
  if (candidates.length === 0) return null;

  const pool = filterByFormalityBand(candidates, targetFormalityRank);

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

  const slotsToFill: OutfitSlot[] = ['footwear', 'bottoms', 'primaryTop', 'watch', 'sunglasses'];
  if (params.includeThermalLayer) slotsToFill.push('thermalLayer');
  if (params.includeOuterwear) slotsToFill.push('outerwear');
  if (params.includeHat) slotsToFill.push('hat');
  if (params.includeBag) slotsToFill.push('bag');

  for (const slot of slotsToFill) {
    const recentGroups = params.recentGroupsBySlot?.[slot] ?? new Set<string>();
    const picked = pickForSlot(slot, params.closetItems, params.tier, params.targetFormalityRank, excludeItemIds, recentGroups);
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
  tier: TierSlug;
  /** Weather-gated — caller decides based on temperature. */
  includeThermalLayer: boolean;
  includeOuterwear: boolean;
  includeHat?: boolean;
  includeBag?: boolean;
  /** Item ids to omit entirely (e.g. already fixed elsewhere, like an anchor). */
  excludeItemIds?: ReadonlySet<string>;
  maxPerSlot?: number;
};

/**
 * Builds a generous, formality-filtered candidate list per slot — the
 * shortlist an LLM chooses from, not a single deterministic pick. secondary
 * top is always offered (not weather-gated) since it's a style/formality
 * choice, not insulation — every tier's framework includes it, optional for
 * casual/smart-casual and required for business. Widens to the full
 * candidate set for a slot if nothing qualifies within the target formality
 * band (a slightly-off option beats none), matching the same graceful-
 * degradation behavior as buildDeterministicOutfit — but NEVER widens past
 * the tier's hard-restricted allowedGroups (business footwear never widens
 * into sneakers just because the closet lacks dress shoes at the right
 * formality tag; that's what fillMissingRequiredSlots' fallback is for).
 */
export function buildOutfitSlotShortlists<TItem extends BuilderClosetItem>(
  params: SlotShortlistParams<TItem>,
): SlotShortlists<TItem> {
  const excludeItemIds = params.excludeItemIds ?? new Set<string>();
  const maxPerSlot = params.maxPerSlot ?? DEFAULT_MAX_PER_SLOT;

  const slotsToInclude: OutfitSlot[] = ['footwear', 'bottoms', 'primaryTop', 'secondaryTop', 'watch', 'sunglasses'];
  if (params.includeThermalLayer) slotsToInclude.push('thermalLayer');
  if (params.includeOuterwear) slotsToInclude.push('outerwear');
  if (params.includeHat) slotsToInclude.push('hat');
  if (params.includeBag) slotsToInclude.push('bag');

  const bySlot: SlotShortlists<TItem> = {};

  for (const slot of slotsToInclude) {
    const allowedGroups = effectiveAllowedGroups(slot, params.tier);
    const candidates = params.closetItems.filter((item) => {
      if (excludeItemIds.has(item.id)) return false;
      const group = CATEGORY_TO_GROUP[item.category];
      return group !== undefined && allowedGroups.includes(group);
    });
    if (candidates.length === 0) continue;

    const pool = filterByFormalityBand(candidates, params.targetFormalityRank);

    // Shuffle so a long shortlist doesn't always present the same items in
    // the same position — models can anchor on list order.
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    bySlot[slot] = shuffled.slice(0, maxPerSlot);
  }

  return bySlot;
}

/**
 * "Additional Accessories" shortlist — belt/scarf/tie/socks, offered as its
 * own multi-pick pool (0 or more chosen at once) rather than a single-item
 * OutfitSlot, since the framework explicitly allows more than one at a time.
 */
export function buildAccessoryShortlist<TItem extends BuilderClosetItem>(
  closetItems: TItem[],
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string> = new Set(),
  maxCandidates: number = DEFAULT_MAX_PER_SLOT,
): TItem[] {
  const candidates = closetItems.filter((item) => {
    if (excludeItemIds.has(item.id)) return false;
    const group = CATEGORY_TO_GROUP[item.category];
    return group !== undefined && ACCESSORY_GROUPS.includes(group);
  });
  if (candidates.length === 0) return [];
  const pool = filterByFormalityBand(candidates, targetFormalityRank);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxCandidates);
}

/**
 * Same shortlist philosophy, scoped to a single swap: every candidate in the
 * SAME garment group as the item being replaced (never a different slot),
 * within the formality band — so a shoe swap only ever offers other shoes,
 * and the LLM picks a genuinely different, thoughtfully-coordinated
 * replacement rather than a random one. Doesn't need tier-restriction
 * re-application: the original item was already tier-legal when first
 * chosen, and "same group as original" can never cross into a different,
 * tier-forbidden group.
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

  const pool = filterByFormalityBand(candidates, targetFormalityRank);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxCandidates);
}

function isSuit(item: BuilderClosetItem | undefined): boolean {
  return !!item && CATEGORY_TO_GROUP[item.category] === 'suit';
}

/**
 * A Suit is one physical item that supplies BOTH the bottoms and secondary-
 * top roles at once (trousers + matching jacket) — never a top-half garment
 * meant to be paired with a separate, different blazer. Because bottoms/
 * secondaryTop are chosen as independent schema fields, a model can still
 * pick a suit for one slot and something else (or a different suit) for the
 * other; this normalizes the result in place so exactly one suit ends up
 * occupying both slots whenever either slot resolved to one. Outerwear
 * (a true weatherproof shell) is untouched by this — an overcoat can still
 * be layered over a suit independently.
 */
export function normalizeSuitDualRole<TItem extends BuilderClosetItem>(bySlot: Partial<Record<OutfitSlot, TItem>>): void {
  const bottomsIsSuit = isSuit(bySlot.bottoms);
  const secondaryTopIsSuit = isSuit(bySlot.secondaryTop);

  if (bottomsIsSuit && !secondaryTopIsSuit) {
    bySlot.secondaryTop = bySlot.bottoms;
  } else if (secondaryTopIsSuit && !bottomsIsSuit) {
    bySlot.bottoms = bySlot.secondaryTop;
  } else if (bottomsIsSuit && secondaryTopIsSuit && bySlot.bottoms!.id !== bySlot.secondaryTop!.id) {
    // Two different suits picked for the two slots — collapse to one.
    bySlot.secondaryTop = bySlot.bottoms;
  }
}

/**
 * Last-resort safety net: a slot the caller has decided is required for this
 * outfit (per TIER_SLOT_RULES — footwear/bottoms/primaryTop/watch/sunglasses
 * always, secondaryTop additionally for business, thermalLayer/outerwear
 * only when the weather calls for them) must never end up silently unfilled
 * just because the model's response didn't include it or validation fell
 * back to a narrower path. Tries the tier's hard-restricted groups first
 * (never fills required business footwear with sneakers); only widens to
 * the slot's full group membership if the restricted pool is completely
 * empty (a mismatched pick beats no pick at all). Every already-used id
 * (across all slots) is avoided where possible so this never duplicates an
 * item into two roles.
 */
export function fillMissingRequiredSlots<TItem extends BuilderClosetItem>(params: {
  bySlot: Partial<Record<OutfitSlot, TItem>>;
  closetItems: TItem[];
  requiredSlots: readonly OutfitSlot[];
  tier: TierSlug;
  targetFormalityRank: number;
}): void {
  for (const slot of params.requiredSlots) {
    if (params.bySlot[slot]) continue;

    const usedIds = new Set(Object.values(params.bySlot).map((item) => (item as TItem).id));
    const restrictedGroups = effectiveAllowedGroups(slot, params.tier);
    let candidates = params.closetItems.filter((item) => {
      const group = CATEGORY_TO_GROUP[item.category];
      return group !== undefined && restrictedGroups.includes(group);
    });
    if (candidates.length === 0) {
      const fallbackGroups = SLOT_GROUPS[slot];
      candidates = params.closetItems.filter((item) => {
        const group = CATEGORY_TO_GROUP[item.category];
        return group !== undefined && fallbackGroups.includes(group);
      });
    }
    candidates = filterByFormalityBand(candidates, params.targetFormalityRank);
    const fresh = candidates.find((item) => !usedIds.has(item.id));
    const picked = fresh ?? candidates[0];
    if (picked) params.bySlot[slot] = picked;
  }
}
