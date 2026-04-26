import type { TripOutfitDay } from '@/services/trip-outfits';
import { collectTripOutfitItems, TRIP_PACKING_CATEGORY_ORDER } from './trip-outfit-display';
import type { TripItemCategory } from './trip-outfit-display';

export type PackingItem = {
  name: string;
  count: number;
};

export type PackingGroup = {
  category: TripItemCategory;
  items: PackingItem[];
};

export function buildPackingList(days: TripOutfitDay[]): PackingGroup[] {
  const countMap = new Map<string, { category: TripItemCategory; count: number; displayName: string }>();

  function add(raw: string, category: TripItemCategory) {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    const existing = countMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countMap.set(key, { category, count: 1, displayName: raw.trim() });
    }
  }

  for (const day of days) {
    for (const item of collectTripOutfitItems(day)) {
      add(item.name, item.category);
    }
  }

  const groupMap = new Map<TripItemCategory, PackingItem[]>();
  for (const { category, count, displayName } of countMap.values()) {
    const list = groupMap.get(category) ?? [];
    list.push({ name: displayName, count });
    groupMap.set(category, list);
  }

  return TRIP_PACKING_CATEGORY_ORDER.flatMap((category) => {
    const items = groupMap.get(category);
    return items?.length
      ? [{ category, items: items.sort((a, b) => b.count - a.count) }]
      : [];
  });
}
