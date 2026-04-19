// ── Types ─────────────────────────────────────────────────────────────────────

export type AnchorCategory =
  | 'outerwear'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'formal-top'
  | 'evening-top'
  | 'dress';

export type AnchorSlot = {
  id: string;
  category: AnchorCategory;
  label: string;
  rationale: string;
  required: boolean;
};

export type AnchorRecommendation = {
  minCount: number;
  maxCount: number;
  /** Hard cap for manual mode: numDays × 3 */
  manualCap: number;
  summary: string;
  slots: AnchorSlot[];
};

export type TripAnchorContext = {
  numDays: number;
  destination: string;
  purposes: string[];
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;
  carryOnOnly: boolean;
  climateLabel: string;
  styleVibe: string;
};

// ── Category helpers ──────────────────────────────────────────────────────────

const CLOSET_CATEGORY_MAP: Record<AnchorCategory, string[]> = {
  outerwear:    ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'outerwear'],
  top:          ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover', 'tops'],
  bottom:       ['trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'pant', 'pants', 'bottom', 'bottoms'],
  shoes:        ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'loafer', 'heel', 'sandal', 'trainer', 'footwear'],
  'formal-top': ['blazer', 'shirt', 'blouse', 'suit', 'formal'],
  'evening-top':['blouse', 'top', 'shirt', 'dress'],
  dress:        ['dress', 'jumpsuit', 'romper', 'overalls'],
};

/** True if a closet item's category matches an anchor slot category. */
export function closetCategoryMatchesAnchor(closetCategory: string, anchorCategory: AnchorCategory): boolean {
  const lower = closetCategory.toLowerCase();
  return CLOSET_CATEGORY_MAP[anchorCategory].some((k) => lower.includes(k));
}

// ── Recommender ───────────────────────────────────────────────────────────────

export function recommendTripAnchors(ctx: TripAnchorContext): AnchorRecommendation {
  const { numDays, purposes, willSwim, fancyNights, workoutClothes, laundryAccess, shoesCount, carryOnOnly, climateLabel, styleVibe, destination } = ctx;

  const isBusiness    = purposes.some((p) => ['Business', 'Conference'].includes(p));
  const isFormal      = purposes.some((p) => p === 'Wedding / Event');
  const isBeach       = purposes.some((p) => p === 'Beach / Resort');
  const isAdventure   = purposes.some((p) => p === 'Adventure');
  const isMixed       = purposes.length > 1;
  const hasLaundry    = laundryAccess === 'Yes';
  const isPolished    = styleVibe === 'Polished';

  const climateLC = climateLabel.toLowerCase();
  const isWarm  = /warm|hot|tropical|humid|beach|sunny/i.test(climateLC);
  const isCold  = /cold|cool|chilly|winter|freezing|crisp/i.test(climateLC);

  // ── Base range by duration ────────────────────────────────────────────────

  let minCount: number;
  let maxCount: number;

  if (numDays <= 3)      { minCount = 2; maxCount = 3; }
  else if (numDays <= 5) { minCount = 3; maxCount = 4; }
  else if (numDays <= 7) { minCount = 4; maxCount = 5; }
  else                   { minCount = 4; maxCount = 6; }

  // ── Modifiers ─────────────────────────────────────────────────────────────

  if (hasLaundry)   { minCount = Math.max(1, minCount - 1); maxCount = Math.max(2, maxCount - 1); }
  if (carryOnOnly)  { maxCount = Math.max(minCount, maxCount - 1); }
  if (isBusiness || isPolished) { minCount += 1; }
  if (isFormal)     { minCount += 1; maxCount += 1; }
  if (isMixed)      { maxCount = Math.min(maxCount + 1, 8); }

  minCount = Math.min(minCount, 6);
  maxCount = Math.min(maxCount, 8);
  const manualCap = numDays * 3;

  // ── Slot generation ───────────────────────────────────────────────────────

  const slots: AnchorSlot[] = [];

  // Always: primary top
  slots.push({
    id:       'top-1',
    category: isBusiness ? 'formal-top' : 'top',
    label:    isBusiness    ? 'Smart versatile shirt or blouse'
            : isBeach       ? 'Lightweight top or cover-up'
            : isAdventure   ? 'Durable casual top'
            :                 'Versatile daytime top',
    rationale: isBusiness ? 'The foundation of your work-ready looks'
             : 'Your most-reached-for everyday layer',
    required: true,
  });

  // Always (unless warm beach + dress trip): bottom
  if (!isBeach || !isWarm) {
    slots.push({
      id:       'bottom-1',
      category: 'bottom',
      label:    isBusiness  ? 'Tailored trousers or smart chinos'
              : isAdventure ? 'Durable trousers or shorts'
              :               'Versatile trousers or jeans',
      rationale: 'A reliable bottom that pairs with multiple tops',
      required: true,
    });
  }

  // Dress for beach/warm trips or formal occasions
  if ((isBeach && isWarm) || isFormal) {
    slots.push({
      id:       'dress-1',
      category: isFormal ? 'formal-top' : 'dress',
      label:    isFormal ? 'Formal or elevated occasion outfit'
              :            'Light dress or sundress',
      rationale: isFormal ? 'For your special occasion'
               :            'Effortless warm-weather versatility',
      required: isFormal,
    });
  }

  // Always: shoes
  slots.push({
    id:       'shoes-1',
    category: 'shoes',
    label:    isBusiness  ? 'Smart everyday shoes'
            : isAdventure ? 'Comfortable walking shoes or trainers'
            : isBeach     ? 'Sandals or light flat shoes'
            :               'Versatile everyday shoes',
    rationale: 'Your most-used footwear across the trip',
    required: true,
  });

  // Outerwear for cool/cold or longer trips
  if (isCold || (!isWarm && !isBeach && numDays >= 3)) {
    slots.push({
      id:       'outer-1',
      category: 'outerwear',
      label:    isCold ? 'Warm jacket or coat'
              :          'Light jacket or cardigan',
      rationale: 'Handles temperature shifts and adds polish when layered',
      required: false,
    });
  }

  // Second top for longer / mixed trips
  if (numDays >= 4 && slots.length < maxCount) {
    const needsEveningTop = fancyNights && !isFormal;
    slots.push({
      id:       'top-2',
      category: needsEveningTop ? 'evening-top' : isBusiness ? 'formal-top' : 'top',
      label:    needsEveningTop ? 'Evening or going-out top'
              : isBusiness      ? 'Second smart shirt for variety'
              :                   'Second versatile top',
      rationale: needsEveningTop ? 'Elevates your evening looks without extra bulk'
               :                   'Adds wardrobe variety across the trip',
      required: fancyNights,
    });
  }

  // Second shoe pair (business + fancy nights, enough shoe budget)
  const shoeCountNum = parseInt(shoesCount, 10) || 2;
  if (isBusiness && fancyNights && numDays >= 5 && shoeCountNum >= 2 && slots.length < maxCount) {
    slots.push({
      id:       'shoes-2',
      category: 'shoes',
      label:    'Dressier shoes for evenings',
      rationale: 'Bridges business days and evening occasions',
      required: false,
    });
  }

  // Trim to maxCount
  const finalSlots = slots.slice(0, maxCount);

  // ── Summary ───────────────────────────────────────────────────────────────

  const purposeDesc =
    isBusiness && isFormal ? 'business & formal occasion'
    : isBusiness            ? 'business'
    : isFormal              ? 'formal occasion'
    : isBeach               ? 'beach'
    : isAdventure           ? 'adventure'
    : isMixed               ? 'mixed-purpose'
    :                         'leisure';

  const weatherDesc = isWarm ? 'warm-weather ' : isCold ? 'cold-weather ' : '';
  const dest = destination ? ` to ${destination}` : '';
  const slotLabels = finalSlots.map((s) => s.label.toLowerCase()).join(', ');

  const summary =
    `For this ${numDays}-day ${weatherDesc}${purposeDesc} trip${dest}, ` +
    `we recommend ${minCount}–${maxCount} anchors: ${slotLabels}.`;

  return { minCount, maxCount, manualCap, summary, slots: finalSlots };
}
