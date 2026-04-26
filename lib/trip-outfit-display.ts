import type { TripOutfitDay } from '@/services/trip-outfits';

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

const OUTFIT_GROUP_ORDER: TripItemCategory[] = [
  'Swimwear',
  'Outerwear',
  'Dresses',
  'Tops',
  'Bottoms',
  'Shoes',
  'Bags',
  'Accessories',
];

const CATEGORY_KEYWORDS: [TripItemCategory, string[]][] = [
  ['Swimwear', ['swimsuit', 'bikini', 'boardshort', 'swim trunk', 'swim trunks', 'one-piece', 'swimwear', 'wetsuit', 'swim short']],
  ['Outerwear', ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'overcoat', 'jumper', 'overshirt']],
  ['Tops', ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover', 'knit']],
  ['Bottoms', ['trouser', 'trousers', 'jeans', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'leggings', 'jogger', 'joggers', 'pant', 'pants', 'culottes', 'midi', 'maxi']],
  ['Dresses', ['dress', 'jumpsuit', 'romper', 'overalls']],
];

const OUTFIT_GROUP_LABELS: Record<TripItemCategory, string> = {
  Swimwear: 'Swimwear',
  Outerwear: 'Outerwear',
  Tops: 'Top',
  Bottoms: 'Bottom',
  Dresses: 'Dress / Jumpsuit',
  Shoes: 'Shoes',
  Bags: 'Bag',
  Accessories: 'Accessories',
};

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

  return OUTFIT_GROUP_ORDER.flatMap((category) => {
    const items = groupMap.get(category);
    return items?.length ? [{ label: OUTFIT_GROUP_LABELS[category], items }] : [];
  });
}
