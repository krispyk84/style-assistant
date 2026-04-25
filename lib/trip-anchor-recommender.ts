import type { ClosetItem } from '@/types/closet';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AnchorCategory =
  | 'outerwear'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'formal-top'
  | 'evening-top'
  | 'dress'
  | 'bag';

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
  /** Hard cap for all modes: numDays + 3 */
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
  /** User profile gender — drives anchor taxonomy and closet matching. */
  gender?: 'man' | 'woman' | 'non-binary';
  /** Average daily high in °C — overrides climateLabel text for warm/cold detection when present. */
  avgHighC?: number;
  avgLowC?: number;
};

export type ScoredAnchorCandidate = {
  item: ClosetItem;
  score: number;
  rationale: string;
};

// ── Category helpers ───────────────────────────────────────────────────────────

/**
 * Closet keyword map — default (unisex / womenswear).
 * Used when gender is 'woman', 'non-binary', or unspecified.
 */
const DEFAULT_CATEGORY_KEYWORDS: Record<AnchorCategory, string[]> = {
  outerwear:    ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'outerwear'],
  top:          ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover', 'tops'],
  bottom:       ['trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'pant', 'pants', 'bottom', 'bottoms'],
  shoes:        ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'loafer', 'heel', 'sandal', 'trainer', 'footwear'],
  'formal-top': ['blazer', 'shirt', 'blouse', 'suit', 'formal'],
  'evening-top':['blouse', 'top', 'shirt', 'dress'],
  dress:        ['dress', 'jumpsuit', 'romper', 'overalls'],
  bag:          ['bag', 'tote', 'backpack', 'briefcase', 'handbag', 'satchel', 'crossbody', 'messenger', 'weekender', 'duffel', 'clutch', 'shoulder bag', 'holdall', 'pouch'],
};

/**
 * Menswear keyword map.
 * Excludes blouse, dress, skirt, heels, and other feminine-coded terms.
 */
const MENSWEAR_CATEGORY_KEYWORDS: Record<AnchorCategory, string[]> = {
  outerwear:    ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'outerwear', 'overshirt'],
  top:          ['shirt', 'tee', 't-shirt', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover', 'tops', 'overshirt', 'knit'],
  bottom:       ['trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'chino', 'chinos', 'pant', 'pants', 'bottom', 'bottoms', 'jogger'],
  shoes:        ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'loafer', 'trainer', 'derby', 'oxford', 'footwear', 'sandal'],
  'formal-top': ['blazer', 'shirt', 'suit', 'jacket', 'formal', 'sport coat', 'sport-coat'],
  'evening-top':['shirt', 'polo', 'top', 'knit', 'turtleneck', 'henley'],
  // 'dress' intentionally has no menswear keywords — mens mode never matches this
  dress:        [],
  // Menswear-friendly bag types — excludes handbag/clutch which read feminine
  bag:          ['bag', 'backpack', 'briefcase', 'satchel', 'crossbody', 'messenger', 'weekender', 'duffel', 'shoulder bag', 'holdall', 'tote', 'pouch'],
};

function getCategoryKeywords(category: AnchorCategory, gender?: string): string[] {
  if (gender === 'man') return MENSWEAR_CATEGORY_KEYWORDS[category];
  return DEFAULT_CATEGORY_KEYWORDS[category];
}

/** True if a closet item's category matches an anchor slot category. */
export function closetCategoryMatchesAnchor(
  closetCategory: string,
  anchorCategory: AnchorCategory,
  gender?: string,
): boolean {
  const lower = closetCategory.toLowerCase();
  return getCategoryKeywords(anchorCategory, gender).some((k) => lower.includes(k));
}

// ── Anchor scoring ─────────────────────────────────────────────────────────────

/** Neutral color families that work with most other pieces. */
const NEUTRAL_COLOR_FAMILIES = new Set(['white', 'stone', 'grey', 'black', 'navy', 'camel', 'brown']);
/** Muted / earthy tones — versatile but less universal than neutrals. */
const MUTED_COLOR_FAMILIES   = new Set(['blue', 'olive', 'green', 'burgundy', 'rust']);

/**
 * Score a closet item against an anchor slot and trip context.
 * Returns a 0–100 score and a human-readable rationale string.
 */
export function scoreClosetItemForSlot(
  item: ClosetItem,
  slot: AnchorSlot,
  ctx: TripAnchorContext,
): ScoredAnchorCandidate {
  let score = 0;
  const notes: string[] = [];

  const isWarm = ctx.avgHighC !== undefined ? ctx.avgHighC >= 21 : /warm|hot|tropical|humid|beach|sunny/i.test(ctx.climateLabel);
  const isCold = ctx.avgHighC !== undefined ? ctx.avgHighC < 12 : /cold|cool|chilly|winter|freezing|crisp/i.test(ctx.climateLabel);
  const isBusiness = ctx.purposes.some((p) => ['Business', 'Conference'].includes(p));
  const isLeisure  = ctx.purposes.some((p) => ['Leisure', 'Beach / Resort', 'Adventure'].includes(p));
  const isPolished = ctx.styleVibe === 'Polished' || isBusiness;

  // ── 1. Season / climate fit (0–30) ──────────────────────────────────────────

  const season = (item.season ?? '').toLowerCase();
  const weight = (item.weight ?? '').toLowerCase();

  if (!season || season === 'all season') {
    score += 20;
    notes.push('all-season versatility');
  } else if (isWarm && (season === 'summer' || season === 'spring')) {
    score += 30;
    notes.push('ideal for warm weather');
  } else if (isWarm && season === 'fall') {
    score += 14;
  } else if (isWarm && season === 'winter') {
    score += 3; // heavy winter piece in heat — penalize
    notes.push('warm-weather mismatch');
  } else if (isCold && (season === 'winter' || season === 'fall')) {
    score += 30;
    notes.push('great for cold weather');
  } else if (isCold && season === 'spring') {
    score += 14;
  } else if (isCold && season === 'summer') {
    score += 3;
    notes.push('cold-weather mismatch');
  } else {
    score += 16; // mild climate — any season is acceptable
  }

  // Penalise heavy fabrics in warm climates / reward lightweight ones
  if (isWarm) {
    if (/light|linen|cotton|breathable/i.test(weight)) { score += 5; notes.push('lightweight fabric'); }
    if (/heavy|wool|thick|flannel|cashmere/i.test(weight)) { score -= 5; }
  }
  if (isCold) {
    if (/heavy|wool|cashmere|thick|lined/i.test(weight)) { score += 5; notes.push('warm fabric'); }
    if (/light|linen|thin/i.test(weight)) { score -= 3; }
  }

  // ── 2. Formality fit (0–25) ─────────────────────────────────────────────────

  const formality = (item.formality ?? '').toLowerCase();

  if (isPolished) {
    if (/formal|smart\s*casual/i.test(formality)) { score += 25; notes.push('fits your polished style'); }
    else if (/refined\s*casual/i.test(formality))  { score += 16; }
    else if (/casual/i.test(formality))             { score += 5; }
    else                                            { score += 13; }
  } else if (isLeisure) {
    if (/casual|refined\s*casual/i.test(formality)) { score += 25; notes.push('relaxed and trip-ready'); }
    else if (/smart\s*casual/i.test(formality))     { score += 18; }
    else if (/formal/i.test(formality))             { score += 8; }
    else                                            { score += 16; }
  } else {
    // Smart Casual / mixed vibe
    if (/smart\s*casual|refined\s*casual/i.test(formality)) { score += 25; notes.push('versatile formality'); }
    else if (/casual/i.test(formality))                     { score += 15; }
    else if (/formal/i.test(formality))                     { score += 15; }
    else                                                    { score += 16; }
  }

  // ── 3. Color versatility (0–20) ─────────────────────────────────────────────

  const colorFam = (item.colorFamily ?? '').toLowerCase();
  if (NEUTRAL_COLOR_FAMILIES.has(colorFam)) {
    score += 20;
    notes.push('neutral color pairs with everything');
  } else if (MUTED_COLOR_FAMILIES.has(colorFam)) {
    score += 12;
    notes.push('versatile earthy tone');
  } else if (colorFam) {
    score += 5; // bold / fashion-forward — still usable
  } else {
    score += 10; // unknown color
  }

  // ── 4. Metadata completeness (0–15) ─────────────────────────────────────────
  // Better metadata → higher confidence the item is classified correctly

  const metaFields = [item.subcategory, item.primaryColor, item.material, item.formality, item.silhouette, item.season, item.weight, item.pattern];
  const filledCount = metaFields.filter(Boolean).length;
  score += Math.min(15, filledCount * 2);

  // ── 5. Fit status (0–10) ────────────────────────────────────────────────────

  const fit = item.fitStatus;
  if (fit === 'fits-well' || fit === 'tailored')    { score += 10; }
  else if (fit == null)                             { score += 7; }
  else if (fit === 'fits-large')                    { score += 4; }
  else                                              { score += 2; }

  // ── Build rationale ──────────────────────────────────────────────────────────

  let rationale: string;
  if (notes.length === 0) {
    rationale = `Good match for your ${ctx.numDays}-day ${ctx.climateLabel.toLowerCase()} trip.`;
  } else if (notes.length === 1) {
    rationale = `Chosen for ${notes[0]}.`;
  } else {
    const last = notes.pop()!;
    rationale = `Chosen for ${notes.join(', ')} and ${last}.`;
  }

  return { item, score: Math.max(0, score), rationale };
}

/**
 * Given a list of closet items and a slot, return all candidates sorted best-first.
 * Returns an empty array if no items match the slot category.
 */
export function rankCandidatesForSlot(
  items: ClosetItem[],
  slot: AnchorSlot,
  ctx: TripAnchorContext,
): ScoredAnchorCandidate[] {
  const matching = items.filter((item) =>
    closetCategoryMatchesAnchor(item.category ?? '', slot.category, ctx.gender)
  );
  if (matching.length === 0) return [];
  return matching
    .map((item) => scoreClosetItemForSlot(item, slot, ctx))
    .sort((a, b) => b.score - a.score);
}

// ── Bag slot builder ───────────────────────────────────────────────────────────

/**
 * Build a context-aware bag anchor slot.
 *
 * Picks the bag *type* (briefcase / backpack / weekender / shoulder bag / etc.)
 * that fits the trip's primary purpose, formality, and gender mode. Never
 * defaults to "canvas tote" — the type is always intentionally chosen.
 */
function buildBagSlot(ctx: TripAnchorContext): AnchorSlot {
  const isMens = ctx.gender === 'man';
  const isBusiness  = ctx.purposes.some((p) => ['Business', 'Conference'].includes(p));
  const isAdventure = ctx.purposes.some((p) => p === 'Adventure');
  const isBeach     = ctx.purposes.some((p) => p === 'Beach / Resort');
  const isFormal    = ctx.purposes.some((p) => p === 'Wedding / Event');
  const isPolished  = ctx.styleVibe === 'Polished';
  const isWarm = ctx.avgHighC !== undefined
    ? ctx.avgHighC >= 21
    : /warm|hot|tropical|humid|beach|sunny/i.test(ctx.climateLabel);

  let label: string;
  let rationale: string;

  if (isBusiness) {
    label     = isMens ? 'Briefcase or structured work bag' : 'Structured work bag or slim briefcase';
    rationale = 'Carries laptop and documents while keeping the look polished';
  } else if (isFormal) {
    label     = isMens ? 'Slim leather pouch or document holder for the event' : 'Clutch or small structured evening bag';
    rationale = 'Keeps the formal silhouette uncluttered';
  } else if (isAdventure) {
    label     = 'Practical backpack or daypack';
    rationale = 'Hands-free carry for active days and uneven terrain';
  } else if (isBeach && isWarm) {
    label     = isMens ? 'Lightweight tote or beach-friendly crossbody' : 'Roomy summer tote or beach-friendly crossbody';
    rationale = 'Holds sun gear and is easy to clean';
  } else if (ctx.carryOnOnly && ctx.numDays >= 3) {
    label     = isMens ? 'Weekender or duffel that fits as a personal item' : 'Weekender or carry-all that fits as a personal item';
    rationale = 'Doubles as your travel-day bag';
  } else if (isPolished) {
    label     = isMens ? 'Refined leather shoulder bag or messenger' : 'Refined leather shoulder bag or top-handle';
    rationale = 'Pairs cleanly with elevated daytime looks';
  } else {
    label     = isMens ? 'Versatile shoulder bag or messenger' : 'Versatile day bag or shoulder bag';
    rationale = 'Pairs with most outfits across the trip';
  }

  return { id: 'bag-1', category: 'bag', label, rationale, required: false };
}

/** Whether this trip context warrants suggesting a bag anchor at all. */
function shouldSuggestBag(ctx: TripAnchorContext): boolean {
  const isBusiness  = ctx.purposes.some((p) => ['Business', 'Conference'].includes(p));
  const isAdventure = ctx.purposes.some((p) => p === 'Adventure');
  const isBeach     = ctx.purposes.some((p) => p === 'Beach / Resort');
  const isFormal    = ctx.purposes.some((p) => p === 'Wedding / Event');
  return isBusiness || isAdventure || isBeach || isFormal || ctx.numDays >= 3;
}

// ── Recommender ────────────────────────────────────────────────────────────────

export function recommendTripAnchors(ctx: TripAnchorContext): AnchorRecommendation {
  const {
    numDays, purposes, willSwim, fancyNights, workoutClothes,
    laundryAccess, shoesCount, carryOnOnly, climateLabel, styleVibe,
    destination, gender,
  } = ctx;

  const isMens      = gender === 'man';
  const isBusiness  = purposes.some((p) => ['Business', 'Conference'].includes(p));
  const isFormal    = purposes.some((p) => p === 'Wedding / Event');
  const isBeach     = purposes.some((p) => p === 'Beach / Resort');
  const isAdventure = purposes.some((p) => p === 'Adventure');
  const isMixed     = purposes.length > 1;
  const hasLaundry  = laundryAccess === 'Yes';
  const isPolished  = styleVibe === 'Polished';

  const climateLC = climateLabel.toLowerCase();
  const isWarm = ctx.avgHighC !== undefined ? ctx.avgHighC >= 21 : /warm|hot|tropical|humid|beach|sunny/i.test(climateLC);
  const isCold = ctx.avgHighC !== undefined ? ctx.avgHighC < 12 : /cold|cool|chilly|winter|freezing|crisp/i.test(climateLC);

  // ── Base range by duration ─────────────────────────────────────────────────

  let minCount: number;
  let maxCount: number;

  if (numDays <= 3)      { minCount = 2; maxCount = 3; }
  else if (numDays <= 5) { minCount = 3; maxCount = 4; }
  else if (numDays <= 7) { minCount = 4; maxCount = 5; }
  else                   { minCount = 4; maxCount = 6; }

  // ── Modifiers ──────────────────────────────────────────────────────────────

  if (hasLaundry)                  { minCount = Math.max(1, minCount - 1); maxCount = Math.max(2, maxCount - 1); }
  if (carryOnOnly)                 { maxCount = Math.max(minCount, maxCount - 1); }
  if (isBusiness || isPolished)    { minCount += 1; }
  if (isFormal)                    { minCount += 1; maxCount += 1; }
  if (isMixed)                     { maxCount = Math.min(maxCount + 1, 8); }

  minCount = Math.min(minCount, 6);
  maxCount = Math.min(maxCount, 8);
  const manualCap = numDays + 3;

  // ── Slot generation ────────────────────────────────────────────────────────

  const slots: AnchorSlot[] = [];

  // ── Slot 1: Primary top ────────────────────────────────────────────────────
  if (isMens) {
    slots.push({
      id:       'top-1',
      category: isBusiness ? 'formal-top' : 'top',
      label:    isBusiness    ? 'Smart dress shirt or polo'
              : isBeach       ? 'Lightweight shirt or linen top'
              : isAdventure   ? 'Durable casual shirt'
              :                 'Versatile everyday shirt or tee',
      rationale: isBusiness ? 'The backbone of your work-ready looks'
               : 'Your most-reached-for everyday layer',
      required: true,
    });
  } else {
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
  }

  // ── Slot 2: Bottom (skip for warm beach trips with dress slot coming) ──────
  const willAddDressSlot = !isMens && ((isBeach && isWarm) || isFormal);
  if (!willAddDressSlot || !isBeach || !isWarm) {
    slots.push({
      id:       'bottom-1',
      category: 'bottom',
      label:    isMens
        ? (isBusiness  ? 'Tailored chinos or smart trousers'
         : isAdventure ? 'Durable trousers or shorts'
         :               'Versatile chinos or jeans')
        : (isBusiness  ? 'Tailored trousers or smart chinos'
         : isAdventure ? 'Durable trousers or shorts'
         :               'Versatile trousers or jeans'),
      rationale: 'A reliable bottom that pairs with multiple tops',
      required: true,
    });
  }

  // ── Slot 3: Dress/occasion — only for non-mens profiles ───────────────────
  if (!isMens && ((isBeach && isWarm) || isFormal)) {
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

  // For mens + formal events, add a formal slot using formal-top category
  if (isMens && isFormal) {
    slots.push({
      id:       'formal-1',
      category: 'formal-top',
      label:    'Suit jacket or blazer for the occasion',
      rationale: 'For your formal event',
      required: true,
    });
  }

  // ── Slot 4: Shoes ──────────────────────────────────────────────────────────
  slots.push({
    id:       'shoes-1',
    category: 'shoes',
    label:    isMens
      ? (isBusiness  ? 'Smart leather shoes or loafers'
       : isAdventure ? 'Comfortable trainers or walking shoes'
       : isBeach     ? 'Sandals or lightweight trainers'
       :               'Versatile everyday shoes or sneakers')
      : (isBusiness  ? 'Smart everyday shoes'
       : isAdventure ? 'Comfortable walking shoes or trainers'
       : isBeach     ? 'Sandals or light flat shoes'
       :               'Versatile everyday shoes'),
    rationale: 'Your most-used footwear across the trip',
    required: true,
  });

  // ── Slot 5: Outerwear for cool/cold or longer trips ───────────────────────
  if (isCold || (!isWarm && !isBeach && numDays >= 3)) {
    slots.push({
      id:       'outer-1',
      category: 'outerwear',
      label:    isMens
        ? (isCold ? 'Warm jacket or wool coat'
                  : 'Light jacket, blazer, or overshirt')
        : (isCold ? 'Warm jacket or coat'
                  : 'Light jacket or cardigan'),
      rationale: 'Handles temperature shifts and adds polish when layered',
      required: false,
    });
  }

  // ── Slot 6: Second top for longer / mixed trips ───────────────────────────
  if (numDays >= 4 && slots.length < maxCount) {
    const needsEveningTop = fancyNights && !isFormal;
    if (isMens) {
      slots.push({
        id:       'top-2',
        // Mens evening top: still a 'top' or 'formal-top' — never 'evening-top' (blouse-mapped)
        category: needsEveningTop ? (isBusiness ? 'formal-top' : 'top') : (isBusiness ? 'formal-top' : 'top'),
        label:    needsEveningTop ? 'Evening shirt or polo for nights out'
                : isBusiness      ? 'Second smart shirt for variety'
                :                   'Second versatile shirt or tee',
        rationale: needsEveningTop ? 'Elevates your evening looks without extra luggage'
                 :                   'Adds wardrobe variety across the trip',
        required: fancyNights,
      });
    } else {
      slots.push({
        id:       'top-2',
        category: needsEveningTop ? 'evening-top' : isBusiness ? 'formal-top' : 'top',
        label:    needsEveningTop ? 'Evening or going-out top'
                : isBusiness      ? 'Second smart shirt or blouse for variety'
                :                   'Second versatile top',
        rationale: needsEveningTop ? 'Elevates your evening looks without extra bulk'
                 :                   'Adds wardrobe variety across the trip',
        required: fancyNights,
      });
    }
  }

  // ── Slot 7: Second shoe pair (business + fancy nights) ────────────────────
  const shoeCountNum = parseInt(shoesCount, 10) || 2;
  if (isBusiness && fancyNights && numDays >= 5 && shoeCountNum >= 2 && slots.length < maxCount) {
    slots.push({
      id:       'shoes-2',
      category: 'shoes',
      label:    isMens ? 'Dressier leather shoes or loafers for evenings'
                       : 'Dressier shoes for evenings',
      rationale: 'Bridges business days and evening occasions',
      required: false,
    });
  }

  // ── Slot 8: Bag (optional, context-aware) ─────────────────────────────────
  // Bag adds capacity rather than displacing other anchors, since it's a
  // genuinely separate piece type and most real trips need one.
  const wantsBag = shouldSuggestBag(ctx);
  if (wantsBag) {
    maxCount += 1;
    slots.push(buildBagSlot(ctx));
  }

  // Trim to maxCount
  const finalSlots = slots.slice(0, maxCount);

  // ── Validate: remove any dress/feminine slots that leaked through for mens ──
  const safeSlots = isMens
    ? finalSlots.filter((s) => s.category !== 'dress' && s.category !== 'evening-top')
    : finalSlots;

  // ── Summary ────────────────────────────────────────────────────────────────

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
  const slotLabels = safeSlots.map((s) => s.label.toLowerCase()).join(', ');

  const summary =
    `For this ${numDays}-day ${weatherDesc}${purposeDesc} trip${dest}, ` +
    `we recommend ${minCount}–${maxCount} anchors: ${slotLabels}.`;

  return { minCount, maxCount, manualCap, summary, slots: safeSlots };
}

/**
 * Returns the next anchor slot to add beyond the initial recommendation.
 * Cycles through base slots that aren't yet in `usedSlotIds`, then falls
 * back to generic "extra variety" slots.
 */
export function nextAnchorSlot(
  ctx: TripAnchorContext,
  usedSlotIds: string[],
): AnchorSlot {
  const rec = recommendTripAnchors(ctx);
  const unused = rec.slots.find((s) => !usedSlotIds.includes(s.id));
  if (unused) return unused;

  // All base slots used — generate a numbered extra slot
  const extraCount = usedSlotIds.filter((id) => id.startsWith('extra-')).length;
  const isMens = ctx.gender === 'man';
  const extraSlots: AnchorSlot[] = [
    {
      id:       `extra-${extraCount}`,
      category: 'top',
      label:    isMens ? 'Extra shirt or tee for variety' : 'Extra top for variety',
      rationale: 'Adds outfit flexibility across the trip',
      required: false,
    },
    {
      id:       `extra-${extraCount}`,
      category: 'bottom',
      label:    isMens ? 'Second pair of trousers or jeans' : 'Second bottom or skirt',
      rationale: 'Doubles outfit combinations without extra bulk',
      required: false,
    },
    {
      id:       `extra-${extraCount}`,
      category: 'outerwear',
      label:    isMens ? 'Light jacket or cardigan' : 'Light layer or cardigan',
      rationale: 'Useful for temperature changes and evenings',
      required: false,
    },
    {
      id:       `extra-${extraCount}`,
      category: 'shoes',
      label:    isMens ? 'Second shoe option' : 'Second pair of shoes',
      rationale: 'Alternates between casual and dressier looks',
      required: false,
    },
    {
      id:       `extra-${extraCount}`,
      category: 'bag',
      label:    isMens ? 'Additional bag for the trip' : 'Additional bag option',
      rationale: 'Switch between day and evening looks, or daytime and active needs',
      required: false,
    },
  ];

  return extraSlots[extraCount % extraSlots.length]!;
}
