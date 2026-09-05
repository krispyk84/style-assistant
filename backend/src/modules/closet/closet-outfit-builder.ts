import { CATEGORY_TO_GROUP, FORMALITY_RANK, SLOT_GROUPS, type OutfitSlot } from './closet-taxonomy.js';

/**
 * Deterministic, code-driven closet-only outfit selection — shared by
 * Generate 5 Outfits, the trip planner's From My Closet mode, and Create a
 * Look's closet-only path. Item SELECTION happens here, not in the LLM: the
 * LLM's role downstream is narrowed to narrating an already-fixed set of
 * real items (title/rationale), which is what actually fixes the formality
 * mismatches, phantom pieces, and non-differentiated "variants" that prompt
 * instructions alone couldn't reliably prevent.
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

/**
 * Picks up to `count` distinct replacement candidates for a variant swap,
 * constrained to the SAME garment group as the item being replaced (not
 * just "a different real item") — used by generateOutfitVariations/
 * generateDayVariants so a shoe swap only ever offers other shoes, and each
 * of the (up to 5) variants gets a genuinely different real replacement.
 */
export function pickVariantReplacements<TItem extends BuilderClosetItem>(
  originalItem: TItem,
  closetItems: TItem[],
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string>,
  count: number,
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

  // Shuffle then take the first `count` — each variant gets a distinct real item.
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
