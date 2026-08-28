// Mirrors backend/src/modules/closet/closet-outfits.service.ts MIN_WARDROBE_SIZE
// and BOTTOM_CATEGORIES/FOOTWEAR_CATEGORIES — the actual requirements the
// Generate 5 Outfits backend enforces. TOP_CATEGORIES has no backend
// equivalent (the backend only hard-requires bottom+footwear coverage), but
// a wardrobe of only bottoms and shoes can't produce a sensible outfit
// either, so it's included here as a client-side "is this actually usable"
// signal.
const MIN_TOTAL_ITEMS = 5;

const BOTTOM_CATEGORIES = new Set(['Trousers', 'Denim', 'Shorts', 'Suit']);
const FOOTWEAR_CATEGORIES = new Set(['Shoes', 'Sneakers', 'Loafers', 'Boots']);
const TOP_CATEGORIES = new Set([
  'Shirt', 'T-Shirt', 'Polo', 'Knitwear', 'Sweatshirt', 'Hoodie',
  'Overshirt', 'Cardigan', 'Blazer', 'Suit', 'Tank Top', 'Vest', 'Coat', 'Outerwear',
]);

export type ClosetReadiness = {
  ready: boolean;
  itemCount: number;
  missing: string[];
};

export function evaluateClosetReadiness(items: { category: string }[]): ClosetReadiness {
  const missing: string[] = [];

  if (items.length < MIN_TOTAL_ITEMS) missing.push(`${MIN_TOTAL_ITEMS - items.length} more item${MIN_TOTAL_ITEMS - items.length === 1 ? '' : 's'}`);
  if (!items.some((item) => TOP_CATEGORIES.has(item.category))) missing.push('a top');
  if (!items.some((item) => BOTTOM_CATEGORIES.has(item.category))) missing.push('bottoms');
  if (!items.some((item) => FOOTWEAR_CATEGORIES.has(item.category))) missing.push('footwear');

  return { ready: missing.length === 0, itemCount: items.length, missing };
}
