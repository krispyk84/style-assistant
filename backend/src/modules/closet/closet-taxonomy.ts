/**
 * Backend copy of the garment-group and formality taxonomy used for
 * deterministic closet-only outfit selection (closet-outfit-builder.ts).
 * Mirrors lib/closet-match-taxonomy.ts's CATEGORY_TO_GROUP/FORMALITY_RANK
 * 1:1 — kept as a separate copy since the builder runs backend-side and
 * that file lives in the frontend `lib/` tree. Keep both in sync by hand;
 * a shared package is the real fix but is out of scope here.
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
  Overshirt:       'jacket',
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

export type OutfitSlot = 'footwear' | 'bottoms' | 'tops' | 'layering' | 'outerwear' | 'hat' | 'bag' | 'watch' | 'sunglasses';

// Which garment groups satisfy each slot. Order doesn't matter — selection
// weighting is handled by closet-outfit-builder.ts, not by list position.
// watch/sunglasses are separate slots (not one combined "accessory" slot) so
// both get independently attempted rather than only ever picking one.
export const SLOT_GROUPS: Record<OutfitSlot, readonly string[]> = {
  footwear:   ['formal_shoes', 'loafers', 'boots', 'sneakers'],
  bottoms:    ['trousers', 'denim', 'shorts'],
  tops:       ['shirt', 'polo', 'tee'],
  layering:   ['knitwear', 'cardigan', 'hoodie'],
  outerwear:  ['blazer', 'jacket', 'coat'],
  hat:        ['hat'],
  bag:        ['bag'],
  watch:      ['watch'],
  sunglasses: ['sunglasses'],
};

// Day/tier formality labels mapped to a target FORMALITY_RANK value.
export const TIER_FORMALITY_TARGET: Record<string, number> = {
  business: FORMALITY_RANK['Formal'],
  'smart-casual': FORMALITY_RANK['Refined Casual'],
  casual: FORMALITY_RANK['Casual'],
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
