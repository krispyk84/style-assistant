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

  // Two distinct failure modes need separate hard rules: when there's no
  // outerwear listed, the model sometimes adds one anyway (handled below).
  // When outerwear IS listed, the model instead tends to invent an EXTRA
  // layer underneath it (a shirt/sweater collar or placket peeking out)
  // that isn't in the garments list, to make an open jacket read as more
  // "complete" — this was the actual reported bug (jacket + trousers + one
  // top rendered with a second, unlisted top visible underneath the jacket).
  const outerwearRule =
    outerwear.length === 0
      ? 'OUTERWEAR: FORBIDDEN. No jacket, blazer, coat, or third layer of any kind — the figure wears only the listed top(s), nothing over them.'
      : garments.length > 0
        ? `LAYERING UNDER OUTERWEAR — HARD CONSTRAINT: underneath ${outerwear.map(describeItem).join(', ')}, the figure wears ONLY ${garments.map(describeItem).join(', ')} — nothing else. Do not render a second top, undershirt, sweater, or any other layer beneath the outerwear, and do not show so much as a sliver of collar, placket, or cuff from any garment not in that list. Whatever is visible under the outerwear (whether worn open or closed) must be exactly the garment(s) named above, never an invented additional layer.`
        : null;

  // Garment CONSTRUCTION fidelity — a separate failure mode from adding/
  // omitting a piece: the model sometimes renders a correctly-listed item as
  // a simpler, generic garment (e.g. a "collared button-up shirt" drawn as a
  // plain crew-neck tee with no collar or buttons). The item's exact name
  // already states its construction — this makes reading it literally an
  // explicit instruction rather than trusting the model to infer it.
  const constructionRule =
    'GARMENT CONSTRUCTION — read each garment name literally, do not simplify or generalize it: ' +
    'if a name includes "shirt", "button-up", "button-down", "collared", or "dress shirt", draw a full button placket down the front and a clearly visible point/spread collar — never a collarless pullover. ' +
    'If a name includes "polo", draw a soft collar and a short 2-3 button placket, no full-length buttons. ' +
    'If a name includes "t-shirt", "tee", "crew neck", or "tank", draw NO collar and NO buttons — a plain pullover neckline only. ' +
    'If a name includes "cardigan", draw a full button or zip front over a knit body. ' +
    'If a name includes "hoodie", draw an attached hood. ' +
    'Match every other named detail (crewneck vs. collar, zip vs. button, short vs. long sleeve, pattern, silhouette) exactly as stated rather than defaulting to the simplest/most generic version of that garment category.';

  // Named-checklist verification, not just a count — a right-count-wrong-
  // garment substitution (e.g. a listed suit jacket replaced by a generic
  // dark jacket) passes a bare count check but fails this one.
  const allNamedItems = input.items.map(describeItem).join(', ') || 'none';
  const verificationRule =
    `FINAL VERIFICATION CHECKLIST (check every line before finalizing): go through this exact item list one by one — ${allNamedItems}. For each one, confirm it is actually visible on the figure, drawn as its own named color/material/construction — not substituted, not simplified, not omitted. Then confirm nothing else is visible that isn't on this exact list. Both directions are hard failures: a listed item missing from the image, or an unlisted item present in the image (including any accessory or footwear only mentioned by name here but never drawn).`;

  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    input.subjectBrief ?? null,
    STYLE_PREAMBLE,
    outfitSection,
    exclusivityRule,
    outerwearRule,
    constructionRule,
    'Every listed item is a REAL garment the wearer already owns — render each one true to its stated color, pattern, and material rather than inventing a different interpretation.',
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
    verificationRule,
  ].filter(Boolean);

  return parts.join('\n\n');
}
