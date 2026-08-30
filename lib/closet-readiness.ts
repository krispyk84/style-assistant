import { CATEGORY_TO_GROUP, GARMENT_GROUPS } from './closet-match-taxonomy';

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

// Garment-group keys (from closet-match-taxonomy's CATEGORY_TO_GROUP /
// GARMENT_GROUPS) that count toward each slot.
const TOP_GROUPS = new Set(['shirt', 'polo', 'tee', 'knitwear', 'cardigan', 'hoodie', 'blazer', 'jacket', 'coat', 'suit']);
const BOTTOM_GROUPS = new Set(['trousers', 'denim', 'shorts']);
const FOOTWEAR_GROUPS = new Set(['sneakers', 'loafers', 'boots', 'formal_shoes']);

// New closet items are frequently saved with a generic category ("Clothing",
// the form's own fallback default when nothing more specific was picked or
// auto-detected) rather than a garment-specific one — those items are
// otherwise invisible to every category-aware feature, not just this one.
// Falling back to keyword-matching the item's own title (the same matching
// GARMENT_GROUPS already does for the AI closet-matching engine) recovers
// most of these instead of undercounting a closet that actually has enough
// variety, just not perfectly categorised.
function resolveGarmentGroup(item: { category: string; title: string; subcategory?: string | null }): string | null {
  const directGroup = CATEGORY_TO_GROUP[item.category];
  if (directGroup) return directGroup;

  const haystack = `${item.title} ${item.subcategory ?? ''} ${item.category}`.toLowerCase();
  for (const [group, keywords] of Object.entries(GARMENT_GROUPS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return group;
  }
  return null;
}

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

export function evaluateClosetReadiness(items: { category: string; title: string; subcategory?: string | null }[]): ClosetReadiness {
  const groups = items.map(resolveGarmentGroup);
  const tops = groups.filter((group) => group !== null && TOP_GROUPS.has(group)).length;
  const bottoms = groups.filter((group) => group !== null && BOTTOM_GROUPS.has(group)).length;
  const footwear = groups.filter((group) => group !== null && FOOTWEAR_GROUPS.has(group)).length;

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
