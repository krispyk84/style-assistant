/**
 * Backend copy of the garment-group and formality taxonomy used for
 * deterministic closet-only outfit selection (closet-outfit-builder.ts).
 * Mirrors lib/closet-match-taxonomy.ts's CATEGORY_TO_GROUP/FORMALITY_RANK
 * 1:1 — kept as a separate copy since the builder runs backend-side and
 * that file lives in the frontend `lib/` tree. Keep both in sync by hand;
 * a shared package is the real fix but is out of scope here.
 *
 * The outfit FRAMEWORK below (which slots exist, which are required, which
 * garment groups a tier is allowed to draw from) is the code-enforced
 * structure behind every closet-only generation surface (Generate 5
 * Outfits, Trip Planner From My Closet, Create a Look closet-only):
 *
 *   Footwear (required) · Bottoms (required) · Primary Top (required)
 *   Secondary Top (optional; blazer/sport jacket, or a thin sweater for
 *   smart-casual — REQUIRED for business, blazer/sport jacket only)
 *   Thermal Layer (optional, weather-gated — sweaters/hoodies/overshirts/
 *   vests; business restricts this to a plain sweater worn under the jacket)
 *   Outerwear (optional, weather-gated — jackets/coats; business restricts
 *   this to overcoats, never a casual jacket, so it can accommodate a suit)
 *   Sunglasses (required) · Watch (required)
 *   Additional Accessories (optional, any number — belt/scarf/tie/socks)
 *
 * A Suit is a single physical item that fills BOTH Bottoms and Secondary
 * Top at once (trousers + matching jacket) — never mixed with a separate
 * pair of trousers or a separate blazer. Business tier additionally hard-
 * restricts footwear to dress shoes/loafers, bottoms to trousers, primary
 * top to button-up shirts, and secondary top to blazers/sport jackets —
 * these are never left to model preference.
 */

// Maps stored ClosetItem.category → canonical garment group key.
export const CATEGORY_TO_GROUP: Record<string, string> = {
  Trousers:        'trousers',
  Denim:           'denim',
  Shorts:          'shorts',
  Shirt:           'shirt',
  Polo:            'polo',
  Knitwear:        'knitwear',
  Cardigan:        'cardigan',
  Hoodie:          'hoodie',
  Blazer:          'blazer',
  'Sports Jacket': 'blazer',
  Jacket:          'jacket',
  // Intentionally its own group, distinct from 'jacket' — an overshirt fills
  // the THERMAL LAYER slot (a mid-layer garment), never OUTERWEAR. The
  // frontend's lib/closet-match-taxonomy.ts groups Overshirt with 'jacket'
  // instead, for a different purpose (AI-piece-to-closet-item matching, not
  // slot assignment) — see __tests__/closet-taxonomy-frontend-drift.test.ts
  // for why both are correct for their own use.
  Overshirt:       'overshirt',
  Vest:            'vest',
  Coat:            'coat',
  Suit:            'suit',
  Shoes:           'formal_shoes',
  Sneakers:        'sneakers',
  Loafers:         'loafers',
  Boots:           'boots',
  Belt:            'belt',
  Bag:             'bag',
  Watch:           'watch',
  Scarf:           'scarf',
  Hat:             'hat',
  Tie:             'tie',
  Socks:           'socks',
  'T-Shirt':       'tee',
  'Swim Shirt':    'tee',
  'Performance Top': 'tee',
  'Athletic Top':  'tee',
  'Tank Top':      'tee',
  Sunglasses:      'sunglasses',
};

// A structured, tailored jacket is sometimes catalogued under the generic
// 'Jacket' category rather than 'Blazer'/'Sports Jacket' (common when photo
// analysis doesn't distinguish a sports coat from a casual jacket) — this
// would otherwise put it in the outerwear slot instead of secondaryTop,
// where it structurally belongs. The item's own title reliably says which
// one it actually is (a true casual outerwear jacket — bomber, field jacket,
// denim jacket — never carries these words), so it's used as a correction
// on top of the stored category rather than trusting category alone here.
const BLAZER_LIKE_TITLE_KEYWORDS = ['blazer', 'sports jacket', 'sport jacket', 'sport coat', 'sportcoat'];

/**
 * Resolves an item's canonical garment group — CATEGORY_TO_GROUP's lookup,
 * corrected for a 'Jacket'-categorized item whose own title identifies it as
 * a blazer/sports jacket. Use this instead of indexing CATEGORY_TO_GROUP
 * directly wherever an item's title is available.
 */
export function resolveGarmentGroup(item: { category: string; title: string }): string | undefined {
  const group = CATEGORY_TO_GROUP[item.category];
  if (group === 'jacket') {
    const title = item.title.toLowerCase();
    if (BLAZER_LIKE_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))) return 'blazer';
  }
  return group;
}

// Casual=0 -> Formal=3, mirrors OUTFIT_PIECE_CATEGORIES' formality enum.
export const FORMALITY_RANK: Record<string, number> = {
  'Casual':         0,
  'Smart Casual':   1,
  'Refined Casual': 2,
  'Formal':         3,
};

export type OutfitSlot =
  | 'footwear'
  | 'bottoms'
  | 'primaryTop'
  | 'secondaryTop'
  | 'thermalLayer'
  | 'outerwear'
  | 'hat'
  | 'bag'
  | 'watch'
  | 'sunglasses';

// Which garment groups satisfy each slot. Order doesn't matter — selection
// weighting is handled by closet-outfit-builder.ts, not by list position.
// watch/sunglasses are separate slots (not one combined "accessory" slot) so
// both get independently attempted rather than only ever picking one.
// 'suit' is deliberately listed under BOTH bottoms and secondaryTop — a suit
// is one physical item that supplies both roles at once (trousers + jacket),
// never a separate top-half garment worn alongside a different jacket. A
// suit's jacket occupies the same structural role as a blazer/sport jacket
// (secondaryTop), NOT the same role as true weatherproof outerwear — an
// overcoat can still be layered on top of a suit on a cold day.
// closet-outfit-builder.ts's normalizeSuitDualRole is what actually enforces
// "if either slot resolves to a suit, both slots resolve to that same suit."
export const SLOT_GROUPS: Record<OutfitSlot, readonly string[]> = {
  footwear:     ['formal_shoes', 'loafers', 'boots', 'sneakers'],
  bottoms:      ['trousers', 'denim', 'shorts', 'suit'],
  primaryTop:   ['shirt', 'polo', 'tee'],
  secondaryTop: ['blazer', 'suit'],
  thermalLayer: ['knitwear', 'cardigan', 'hoodie', 'overshirt', 'vest'],
  outerwear:    ['jacket', 'coat'],
  hat:          ['hat'],
  bag:          ['bag'],
  watch:        ['watch'],
  sunglasses:   ['sunglasses'],
};

// "Additional Accessories" — a multi-pick pool (can be more than 1 at once),
// so it's handled as its own array field everywhere it's offered rather than
// as a single-item OutfitSlot the way watch/sunglasses/hat/bag are.
export const ACCESSORY_GROUPS: readonly string[] = ['belt', 'scarf', 'tie', 'socks'];

export type TierSlug = 'casual' | 'smart-casual' | 'business';

// Day/tier formality labels mapped to a target FORMALITY_RANK value.
export const TIER_FORMALITY_TARGET: Record<TierSlug, number> = {
  business: FORMALITY_RANK['Formal'],
  'smart-casual': FORMALITY_RANK['Refined Casual'],
  casual: FORMALITY_RANK['Casual'],
};

// Derives the discrete enforced tier from a continuous formality rank — lets
// every caller (Generate 5 Outfits / Create a Look, which already key off a
// named tier, and the Trip Planner, which keys off a dayType→rank mapping)
// resolve the SAME hard framework rules from whatever rank they already
// compute, without needing a second parallel classification.
export function tierForFormalityRank(rank: number): TierSlug {
  if (rank >= FORMALITY_RANK['Formal']) return 'business';
  if (rank >= FORMALITY_RANK['Refined Casual']) return 'smart-casual';
  return 'casual';
}

export type TierSlotRule = {
  /** Whether this outfit must never leave the slot empty. */
  required: boolean;
  /**
   * Hard-restricts candidates for this slot to exactly these garment groups,
   * overriding SLOT_GROUPS' full membership — e.g. business footwear only
   * ever offers dress shoes/loafers, never sneakers, regardless of how an
   * individual item happens to be formality-tagged. Omitted means the full
   * SLOT_GROUPS membership for that slot is allowed.
   */
  allowedGroups?: readonly string[];
};

// The enforced outfit framework, per tier — this table IS the code-level
// enforcement of "footwear/bottoms/primary top/sunglasses/watch always;
// secondary top/thermal layer/outerwear optional (secondary top required
// for business); business hard-restricted to dress shoes, trousers, button-
// up shirts, and blazers/sport jackets." See the module docblock for the
// full framework description.
export const TIER_SLOT_RULES: Record<TierSlug, Partial<Record<OutfitSlot, TierSlotRule>>> = {
  casual: {
    footwear:     { required: true },
    bottoms:      { required: true, allowedGroups: ['trousers', 'denim', 'shorts'] },
    primaryTop:   { required: true },
    secondaryTop: { required: false },
    thermalLayer: { required: false },
    outerwear:    { required: false },
    watch:        { required: true },
    sunglasses:   { required: true },
  },
  'smart-casual': {
    footwear:     { required: true },
    bottoms:      { required: true, allowedGroups: ['trousers', 'denim', 'shorts'] },
    primaryTop:   { required: true },
    // A thin sweater can stand in as the secondary top itself (not layered
    // under something else) alongside the usual blazer/sport coat.
    secondaryTop: { required: false, allowedGroups: ['blazer', 'knitwear'] },
    thermalLayer: { required: false },
    outerwear:    { required: false },
    watch:        { required: true },
    sunglasses:   { required: true },
  },
  business: {
    footwear:     { required: true, allowedGroups: ['formal_shoes', 'loafers'] },
    bottoms:      { required: true, allowedGroups: ['trousers'] },
    primaryTop:   { required: true, allowedGroups: ['shirt'] },
    secondaryTop: { required: true, allowedGroups: ['blazer'] },
    // Business always has a secondary top (blazer or suit jacket), so a
    // thermal layer here means a thin sweater/vest worn UNDER that jacket —
    // never a bulky hoodie/cardigan/overshirt meant to be worn as a visible
    // outer layer, which reads as a mismatch layered on top of a suit.
    // Outerwear means a proper overcoat, never a casual jacket, over a suit.
    thermalLayer: { required: false, allowedGroups: ['knitwear'] },
    outerwear:    { required: false, allowedGroups: ['coat'] },
    watch:        { required: true },
    sunglasses:   { required: true },
  },
};

// The single authoritative reading of "which slots are required for tier X",
// derived directly from TIER_SLOT_RULES — every caller that needs this
// answer should call this function rather than re-deriving or hand-listing
// it, so there is exactly one place that can drift from TIER_SLOT_RULES.
// (Previously duplicated verbatim in trips.service.ts and
// closet-outfits.service.ts, and re-derived by hand — incompletely — in
// outfits.service.ts; all three now call this.)
export function requiredSlotsForTier(tier: TierSlug): OutfitSlot[] {
  return (Object.entries(TIER_SLOT_RULES[tier]) as [OutfitSlot, TierSlotRule][])
    .filter(([, rule]) => rule.required)
    .map(([slot]) => slot);
}

// Previously duplicated verbatim in outfits.service.ts, trips.service.ts,
// and closet-outfits.service.ts — all three now call this.
export function weatherGates(temperatureC: number | null, tier: TierSlug): { includeThermalLayer: boolean; includeOuterwear: boolean } {
  const gates =
    temperatureC == null
      ? { includeThermalLayer: true, includeOuterwear: true }
      : temperatureC >= 24
        ? { includeThermalLayer: false, includeOuterwear: false }
        : temperatureC >= 18
          ? { includeThermalLayer: false, includeOuterwear: true }
          : { includeThermalLayer: true, includeOuterwear: true };

  // Business always has a structured secondary top (blazer or suit jacket)
  // already providing warmth/structure — a genuine overcoat only belongs
  // over that when it's actually cold, not just "mild-cool" like the base
  // gate above allows for casual/smart-casual's optional secondary top.
  if (tier === 'business' && gates.includeOuterwear && temperatureC != null) {
    gates.includeOuterwear = temperatureC < 10;
  }
  return gates;
}

// Whether a tier permits the suit dual-role path at all — casual never
// offers a suit as a bottoms/secondaryTop candidate, no matter what's in
// the closet.
export const TIER_ALLOWS_SUIT: Record<TierSlug, boolean> = {
  casual: false,
  'smart-casual': true,
  business: true,
};

// Reverse of SLOT_GROUPS — which slot(s) a garment group can fill. Used to
// seed "recently used" group diversity from historical item usage, where we
// only know the item's category/group, not which slot it originally filled.
export const GROUP_TO_SLOTS: Record<string, OutfitSlot[]> = {};
for (const [slot, groups] of Object.entries(SLOT_GROUPS) as [OutfitSlot, readonly string[]][]) {
  for (const group of groups) {
    (GROUP_TO_SLOTS[group] ??= []).push(slot);
  }
}

export const TRIP_DAY_TYPE_FORMALITY_TARGET: Record<string, number> = {
  business: FORMALITY_RANK['Formal'],
  meeting: FORMALITY_RANK['Formal'],
  conference: FORMALITY_RANK['Refined Casual'],
  dinner_out: FORMALITY_RANK['Refined Casual'],
  wedding_event: FORMALITY_RANK['Formal'],
  sightseeing: FORMALITY_RANK['Smart Casual'],
  travel_day: FORMALITY_RANK['Casual'],
  relaxed: FORMALITY_RANK['Casual'],
  beach_pool: FORMALITY_RANK['Casual'],
  adventure: FORMALITY_RANK['Casual'],
};
