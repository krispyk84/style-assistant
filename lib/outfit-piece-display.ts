import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';
import { findBestClosetMatch, getMatchConfidencePercent } from './closet-match';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TripItemCategory =
  | 'Swimwear'
  | 'Outerwear'
  | 'Tops'
  | 'Bottoms'
  | 'Dresses'
  | 'Shoes'
  | 'Bags'
  | 'Accessories';

export type TripOutfitItem = {
  name: string;
  category: TripItemCategory;
};

export type TripOutfitGroup = {
  label: string;
  items: string[];
};

/**
 * A piece in an outfit (tier recommendation or trip day) with its closet match.
 * Used by both the look-results card and the trip-day card so they can share the
 * same piece-list rendering and match-sheet interaction.
 *
 * - `label` is the display heading (e.g. 'Anchor', 'Top', 'Outerwear').
 * - `category` is set when the piece originated from a trip day — drives grouped rendering.
 *   Look pieces leave it undefined and use `label` flat.
 */
export type LabeledPiece = {
  label: string;
  value: string;
  matchedClosetItem: ClosetItem | null;
  confidencePercent: number;
  isAnchor?: boolean;
  category?: TripItemCategory;
};

// ── Trip categorisation ────────────────────────────────────────────────────────

export const TRIP_PACKING_CATEGORY_ORDER: TripItemCategory[] = [
  'Swimwear',
  'Outerwear',
  'Tops',
  'Bottoms',
  'Dresses',
  'Shoes',
  'Bags',
  'Accessories',
];

export const TRIP_OUTFIT_GROUP_ORDER: readonly TripItemCategory[] = [
  'Swimwear',
  'Outerwear',
  'Dresses',
  'Tops',
  'Bottoms',
  'Shoes',
  'Bags',
  'Accessories',
];

export const TRIP_OUTFIT_GROUP_LABELS: Record<TripItemCategory, string> = {
  Swimwear: 'Swimwear',
  Outerwear: 'Outerwear',
  Tops: 'Top',
  Bottoms: 'Bottom',
  Dresses: 'Dress / Jumpsuit',
  Shoes: 'Shoes',
  Bags: 'Bag',
  Accessories: 'Accessories',
};

const CATEGORY_KEYWORDS: [TripItemCategory, string[]][] = [
  ['Swimwear', ['swimsuit', 'bikini', 'boardshort', 'swim trunk', 'swim trunks', 'one-piece', 'swimwear', 'wetsuit', 'swim short']],
  ['Outerwear', ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'overcoat', 'jumper', 'overshirt']],
  ['Tops', ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover', 'knit']],
  ['Bottoms', ['trouser', 'trousers', 'jeans', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'leggings', 'jogger', 'joggers', 'pant', 'pants', 'culottes', 'midi', 'maxi']],
  ['Dresses', ['dress', 'jumpsuit', 'romper', 'overalls']],
];

export function categorizeTripItem(
  item: string,
  role: 'piece' | 'shoes' | 'bag' | 'accessory' = 'piece',
): TripItemCategory {
  if (role === 'shoes') return 'Shoes';
  if (role === 'bag') return 'Bags';
  if (role === 'accessory') return 'Accessories';

  const lower = item.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return 'Tops';
}

export function collectTripOutfitItems(day: TripOutfitDay): TripOutfitItem[] {
  const items: TripOutfitItem[] = [];

  for (const piece of day.pieces ?? []) {
    if (piece) items.push({ name: piece, category: categorizeTripItem(piece) });
  }
  if (day.shoes) items.push({ name: day.shoes, category: 'Shoes' });
  if (day.bag) items.push({ name: day.bag, category: 'Bags' });
  for (const accessory of day.accessories ?? []) {
    if (accessory) items.push({ name: accessory, category: 'Accessories' });
  }

  return items;
}

export function getTripDayItemNames(day: TripOutfitDay): string[] {
  return collectTripOutfitItems(day).map((item) => item.name);
}

export function buildTripOutfitGroups(day: TripOutfitDay): TripOutfitGroup[] {
  const groupMap = new Map<TripItemCategory, string[]>();

  for (const item of collectTripOutfitItems(day)) {
    const list = groupMap.get(item.category) ?? [];
    list.push(item.name);
    groupMap.set(item.category, list);
  }

  return TRIP_OUTFIT_GROUP_ORDER.flatMap((category) => {
    const items = groupMap.get(category);
    return items?.length ? [{ label: TRIP_OUTFIT_GROUP_LABELS[category], items }] : [];
  });
}

// ── Closet matching ────────────────────────────────────────────────────────────

/**
 * Builds a map of item name → match result for a list of plain-string pieces.
 * Both the trip-day card and the packing list use this to drive their match indicators.
 */
export function buildPieceMatchMap(
  itemNames: string[],
  closetItems: ClosetItem[] | undefined,
): Map<string, { item: ClosetItem | null; confidencePercent: number }> {
  const map = new Map<string, { item: ClosetItem | null; confidencePercent: number }>();
  if (!closetItems?.length) return map;

  for (const name of itemNames) {
    if (!name || map.has(name)) continue;
    const item = findBestClosetMatch(name, closetItems);
    map.set(name, {
      item,
      confidencePercent: item ? getMatchConfidencePercent(name, item) : 0,
    });
  }
  return map;
}

export function buildMatchedItemNameSet(
  itemNames: string[],
  closetItems: ClosetItem[] | undefined,
): Set<string> {
  const matched = new Set<string>();
  for (const [name, { item }] of buildPieceMatchMap(itemNames, closetItems)) {
    if (item) matched.add(name);
  }
  return matched;
}

// ── Trip day → LabeledPiece adapter ────────────────────────────────────────────

/**
 * Converts a trip day's pieces into the same `LabeledPiece[]` shape look-result cards use,
 * so both flows can render through the shared `OutfitPieceListView`.
 */
export function buildTripDayLabeledPieces(
  day: TripOutfitDay,
  closetItems: ClosetItem[] | undefined,
): LabeledPiece[] {
  return collectTripOutfitItems(day).map(({ name, category }) => {
    const item = closetItems?.length ? findBestClosetMatch(name, closetItems) : null;
    return {
      label: TRIP_OUTFIT_GROUP_LABELS[category],
      value: name,
      matchedClosetItem: item,
      confidencePercent: item ? getMatchConfidencePercent(name, item) : 0,
      category,
    };
  });
}
