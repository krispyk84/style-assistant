import {
  HEADLESS_GUARD,
  QUALITY_ADDENDUM,
  QUALITY_ADDENDUM_2,
  STYLE_GUARD,
  STYLE_PREAMBLE,
} from './sketch-style-preamble.js';

// Full-outfit sketch prompt for a closet-only generated outfit (Generate 5 Outfits
// feature). Unlike tier sketches (one AI-recommended anchor + invented pieces), every
// item here is a real, already-photographed closet item with its own stored design
// metadata — no vision-derived color lock needed, the metadata is already precise.

export type ClosetOutfitSketchItem = {
  title: string;
  category: string;
  primaryColor?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  pattern?: string | null;
  silhouette?: string | null;
};

const OUTERWEAR_CATEGORIES = new Set(['Blazer', 'Sports Jacket', 'Jacket', 'Overshirt', 'Coat', 'Suit']);
const FOOTWEAR_CATEGORIES = new Set(['Shoes', 'Sneakers', 'Loafers', 'Boots']);
const ACCESSORY_CATEGORIES = new Set(['Belt', 'Bag', 'Watch', 'Scarf', 'Hat', 'Tie', 'Socks', 'Sunglasses']);

function describeItem(item: ClosetOutfitSketchItem): string {
  const color = item.primaryColor || item.colorFamily;
  const details = [color, item.pattern, item.material, item.silhouette].filter(Boolean).join(', ');
  return details ? `${item.title} (${details})` : item.title;
}

export function buildClosetOutfitSketchPrompt(input: {
  outfitTitle: string;
  items: ClosetOutfitSketchItem[];
  subjectBrief?: string | null;
}) {
  const outerwear = input.items.filter((item) => OUTERWEAR_CATEGORIES.has(item.category));
  const footwear = input.items.filter((item) => FOOTWEAR_CATEGORIES.has(item.category));
  const accessories = input.items.filter((item) => ACCESSORY_CATEGORIES.has(item.category));
  const garments = input.items.filter(
    (item) => !OUTERWEAR_CATEGORIES.has(item.category) && !FOOTWEAR_CATEGORIES.has(item.category) && !ACCESSORY_CATEGORIES.has(item.category),
  );

  const outfitLines: string[] = [];
  if (garments.length > 0) {
    outfitLines.push(`- garments: ${garments.map(describeItem).join(', ')}`);
  }
  if (outerwear.length > 0) {
    outfitLines.push(`- outerwear: ${outerwear.map(describeItem).join(', ')}`);
  }
  if (footwear.length > 0) {
    outfitLines.push(`- shoes: ${footwear.map(describeItem).join(', ')}`);
  }
  if (accessories.length > 0) {
    outfitLines.push(`- accessories: ${accessories.map(describeItem).join(', ')}`);
  }

  const outfitSection = `Outfit "${input.outfitTitle}":\n${outfitLines.join('\n')}`;

  // Hard "exact item list" constraint. Without this, the model sometimes adds
  // an unlisted layering piece (most often a blazer or jacket) to make the
  // look feel more "complete" or editorial — even when the wardrobe selection
  // has no outerwear at all. This mirrors the established FORBIDDEN-wording
  // pattern used for bag/hat opt-outs in outfits.prompts.ts.
  const exclusivityRule =
    'EXACT ITEM LIST — HARD CONSTRAINT: the items listed above are the ONLY items the figure wears. ' +
    'Do not add any garment, layer, or accessory that is not explicitly listed — no extra jacket, blazer, coat, cardigan, vest, undershirt, scarf, hat, bag, jewelry, or any other piece, no matter how much more "complete" or "editorial" the look would feel with one. ' +
    'If a category (e.g. outerwear, accessories) has no items listed above, the figure must NOT wear or carry anything from that category.';

  const outerwearRule = outerwear.length === 0
    ? 'OUTERWEAR: FORBIDDEN. No jacket, blazer, coat, or third layer of any kind — the figure wears only the listed top(s), nothing over them.'
    : null;

  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    input.subjectBrief ?? null,
    STYLE_PREAMBLE,
    outfitSection,
    exclusivityRule,
    outerwearRule,
    'Every listed item is a REAL garment the wearer already owns — render each one true to its stated color, pattern, and material rather than inventing a different interpretation.',
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
  ].filter(Boolean);

  return parts.join('\n\n');
}
