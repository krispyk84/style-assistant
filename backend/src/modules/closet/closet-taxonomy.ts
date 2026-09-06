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
 *   Secondary Top (optional; blazer/sport jacket — REQUIRED for business)
 *   Thermal Layer (optional, weather-gated — sweaters/hoodies/overshirts)
 *   Outerwear (optional, weather-gated — jackets/coats)
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
  Overshirt:       'overshirt',
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
  thermalLayer: ['knitwear', 'cardigan', 'hoodie', 'overshirt'],
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
    secondaryTop: { required: false },
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
    thermalLayer: { required: false },
    outerwear:    { required: false },
    watch:        { required: true },
    sunglasses:   { required: true },
  },
};

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
