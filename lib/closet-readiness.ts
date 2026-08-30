// Mirrors backend/src/modules/closet/closet-outfits.service.ts MIN_WARDROBE_SIZE
// and BOTTOM_CATEGORIES/FOOTWEAR_CATEGORIES. Per-category minimums are set for
// genuine outfit VARIETY, not just bare coverage — 1 of each category is
// technically enough to generate an outfit, but only ever the same one.
// TOP_CATEGORIES has no backend equivalent (the backend only hard-requires
// bottom+footwear coverage on its generated output), but a wardrobe of only
// bottoms and shoes can't produce a sensible outfit either, so it's included
// here as a client-side "is this actually usable" signal.
const MIN_TOTAL_ITEMS = 10;
const MIN_TOPS = 3;
const MIN_BOTTOMS = 2;
const MIN_FOOTWEAR = 2;

const BOTTOM_CATEGORIES = new Set(['Trousers', 'Denim', 'Shorts', 'Suit']);
const FOOTWEAR_CATEGORIES = new Set(['Shoes', 'Sneakers', 'Loafers', 'Boots']);
const TOP_CATEGORIES = new Set([
  'Shirt', 'T-Shirt', 'Polo', 'Knitwear', 'Sweatshirt', 'Hoodie',
  'Overshirt', 'Cardigan', 'Blazer', 'Suit', 'Tank Top', 'Vest', 'Coat', 'Outerwear',
]);

export type ClosetReadinessProgress = { have: number; need: number };

export type ClosetReadiness = {
  ready: boolean;
  itemCount: number;
  missing: string[];
  /** Structured have/need counts per requirement — powers the Home progress tracker. */
  progress: {
    total: ClosetReadinessProgress;
    tops: ClosetReadinessProgress;
    bottoms: ClosetReadinessProgress;
    footwear: ClosetReadinessProgress;
  };
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function evaluateClosetReadiness(items: { category: string }[]): ClosetReadiness {
  const tops = items.filter((item) => TOP_CATEGORIES.has(item.category)).length;
  const bottoms = items.filter((item) => BOTTOM_CATEGORIES.has(item.category)).length;
  const footwear = items.filter((item) => FOOTWEAR_CATEGORIES.has(item.category)).length;

  const missing: string[] = [];
  if (tops < MIN_TOPS) missing.push(`${pluralize(MIN_TOPS - tops, 'more top')}`);
  if (bottoms < MIN_BOTTOMS) missing.push(`${pluralize(MIN_BOTTOMS - bottoms, 'more bottom')}`);
  if (footwear < MIN_FOOTWEAR) {
    const need = MIN_FOOTWEAR - footwear;
    missing.push(`${need} pair${need === 1 ? '' : 's'} of footwear`);
  }
  // Only surface a generic "more items" callout for whatever total shortfall
  // remains AFTER the category minimums are met — otherwise a closet that's
  // short on every category double-counts the same missing pieces twice.
  const totalShortfall = Math.max(0, MIN_TOTAL_ITEMS - items.length);
  const categoryShortfall = Math.max(0, MIN_TOPS - tops) + Math.max(0, MIN_BOTTOMS - bottoms) + Math.max(0, MIN_FOOTWEAR - footwear);
  const extraItemsNeeded = Math.max(0, totalShortfall - categoryShortfall);
  if (extraItemsNeeded > 0) missing.push(pluralize(extraItemsNeeded, 'more item'));

  return {
    ready: missing.length === 0,
    itemCount: items.length,
    missing,
    progress: {
      total: { have: items.length, need: MIN_TOTAL_ITEMS },
      tops: { have: tops, need: MIN_TOPS },
      bottoms: { have: bottoms, need: MIN_BOTTOMS },
      footwear: { have: footwear, need: MIN_FOOTWEAR },
    },
  };
}
