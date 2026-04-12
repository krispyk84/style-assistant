/**
 * Garment, color, material, formality, and silhouette taxonomy tables
 * for the closet matching engine.
 * Consumed by closet-match.ts — not intended for direct use outside that module.
 */

import type { OutfitPieceCategory } from '@/types/look-request';

// ── Garment group taxonomy ─────────────────────────────────────────────────────
// Maps free text to canonical group keys, used when metadata category is absent.

export const GARMENT_GROUPS: Record<string, readonly string[]> = {
  // Specific accessories first — checked before material-named garment groups so that
  // "merino wool tie", "cashmere pocket square", etc. resolve to the correct category
  // rather than being absorbed by the knitwear group via material keywords.
  tie:          ['tie', 'pocket square', 'bow tie'],
  belt:         ['belt'],
  watch:        ['watch'],
  bag:          ['bag', 'tote', 'briefcase', 'backpack', 'satchel'],
  scarf:        ['scarf'],
  hat:          ['hat', 'cap', 'beanie', 'bucket hat'],
  sunglasses:   ['sunglasses', 'sunglass', 'glasses', 'eyewear', 'shades'],
  socks:        ['sock'],
  trousers:     ['trouser', 'chino', 'slack', 'cord', 'gabardine'],
  denim:        ['jean', 'denim'],
  shorts:       ['short'],
  shirt:        ['shirt', 'oxford shirt', 'button-down', 'button down', 'chambray', 'flannel', 'dress shirt', 'spread collar', 'french cuff'],
  polo:         ['polo'],
  tee:          ['tee', 't-shirt', 'tshirt', 'long sleeve', 'rash guard', 'performance shirt', 'swim shirt', 'base layer'],
  // knitwear: garment-type words only — NOT material terms like merino/cashmere/lambswool.
  // Those are materials (already in MATERIAL_GROUPS.wool) and must not cause "black merino
  // wool tie" to classify as knitwear instead of tie.
  knitwear:     ['sweater', 'knitwear', 'crewneck', 'jumper', 'pullover', 'cable knit', 'ribbed knit'],
  cardigan:     ['cardigan'],
  hoodie:       ['hoodie', 'sweatshirt'],
  blazer:       ['blazer', 'sports jacket', 'sport coat', 'sport jacket', 'sportcoat'],
  jacket:       ['jacket', 'overshirt', 'chore coat', 'chore', 'shacket', 'field jacket', 'trucker', 'harrington'],
  coat:         ['coat', 'topcoat', 'overcoat', 'trench', 'mac', 'raincoat'],
  suit:         ['suit'],
  sneakers:     ['sneaker', 'trainer', 'runner', 'canvas shoe', 'court shoe', 'plimsoll'],
  loafers:      ['loafer', 'penny loafer', 'moccasin', 'slip-on'],
  boots:        ['boot', 'chelsea', 'chukka', 'desert boot'],
  formal_shoes: ['oxford shoe', 'derby shoe', 'brogue', 'monk strap', 'oxford', 'oxfords', 'cap-toe', 'cap toe', 'dress shoe'],
};

// Maps stored ClosetItem.category → garment group key.
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

// Maps OutfitPieceCategory → garment group key for related-group checks.
export const OUTFIT_CATEGORY_TO_GROUP: Partial<Record<OutfitPieceCategory, string>> = {
  Blazer:          'blazer',
  Coat:            'coat',
  Outerwear:       'jacket',
  Overshirt:       'jacket',
  Vest:            'jacket',
  Shirt:           'shirt',
  Polo:            'polo',
  'T-Shirt':       'tee',
  'Tank Top':      'tee',
  'Swim Shirt':    'tee',
  Knitwear:        'knitwear',
  Cardigan:        'cardigan',
  Hoodie:          'hoodie',
  Sweatshirt:      'hoodie',
  Trousers:        'trousers',
  Denim:           'denim',
  Shorts:          'shorts',
  'Swimming Shorts': 'shorts',
  Sneakers:        'sneakers',
  Loafers:         'loafers',
  Boots:           'boots',
  Shoes:           'formal_shoes',
  Belt:            'belt',
  Bag:             'bag',
  Watch:           'watch',
  Scarf:           'scarf',
  Hat:             'hat',
  Tie:             'tie',
  Socks:           'socks',
  Suit:            'suit',
};

// Groups that are meaningfully related — allow partial category credit.
export const RELATED_GROUP_SETS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['blazer', 'jacket', 'coat']),
  new Set(['shirt', 'polo']),
  new Set(['trousers', 'denim', 'shorts']),
  new Set(['sneakers', 'loafers', 'boots', 'formal_shoes']),
  new Set(['knitwear', 'cardigan', 'hoodie']),
];

// ── Color families ─────────────────────────────────────────────────────────────

export const COLOR_FAMILIES: Record<string, readonly string[]> = {
  white:    ['white', 'cream', 'ivory', 'ecru', 'off-white', 'chalk', 'bone', 'milk', 'optical white'],
  stone:    ['stone', 'khaki', 'beige', 'sand', 'tan', 'oatmeal', 'wheat', 'natural', 'linen', 'taupe', 'putty', 'parchment'],
  camel:    ['camel', 'caramel', 'biscuit'],
  grey:     ['grey', 'gray', 'silver', 'heather', 'slate', 'ash', 'charcoal', 'graphite', 'marl', 'steel', 'stainless', 'gunmetal'],
  black:    ['black', 'onyx', 'jet', 'ebony'],
  navy:     ['navy', 'midnight blue', 'ink blue', 'naval'],
  blue:     ['blue', 'cobalt', 'royal blue', 'sky blue', 'powder blue', 'cerulean', 'electric blue', 'light blue'],
  brown:    ['brown', 'cognac', 'chocolate', 'tobacco', 'walnut', 'chestnut', 'whiskey', 'mahogany', 'coffee', 'mocha'],
  rust:     ['rust', 'terra cotta', 'terracotta', 'sienna', 'burnt orange'],
  olive:    ['olive', 'army', 'military green', 'moss', 'khaki green'],
  green:    ['green', 'forest', 'sage', 'hunter', 'emerald', 'bottle green', 'pine'],
  burgundy: ['burgundy', 'wine', 'bordeaux', 'garnet', 'claret', 'merlot', 'oxblood'],
  red:      ['red', 'crimson', 'scarlet', 'tomato'],
  pink:     ['pink', 'rose', 'blush', 'dusty pink', 'mauve', 'salmon'],
  yellow:   ['yellow', 'mustard', 'amber', 'gold', 'golden', 'ochre'],
  purple:   ['purple', 'violet', 'lavender', 'lilac', 'plum'],
};

// ── Material groups ────────────────────────────────────────────────────────────

export const MATERIAL_GROUPS: Record<string, readonly string[]> = {
  wool:      ['wool', 'merino', 'cashmere', 'lambswool', 'shetland', 'worsted', 'flannel', 'tweed'],
  cotton:    ['cotton', 'poplin', 'oxford cloth', 'twill', 'canvas', 'jersey', 'chambray', 'percale'],
  linen:     ['linen', 'ramie', 'linen blend'],
  denim:     ['denim', 'selvedge', 'raw denim'],
  leather:   ['leather', 'suede', 'nubuck', 'calfskin', 'pebbled leather'],
  synthetic: ['nylon', 'polyester', 'poly', 'synthetic', 'tech', 'performance', 'stretch'],
  silk:      ['silk', 'satin', 'crepe', 'charmeuse'],
  knit:      ['knit', 'ribbed', 'waffle', 'cable', 'interlock'],
};

// ── Formality scale ────────────────────────────────────────────────────────────

export const FORMALITY_RANK: Record<string, number> = {
  'Casual':         0,
  'Smart Casual':   1,
  'Refined Casual': 2,
  'Formal':         3,
};

// ── Silhouette hint vocabulary ─────────────────────────────────────────────────

export const SILHOUETTE_HINTS: Record<string, readonly string[]> = {
  slim:      ['slim', 'fitted', 'skinny', 'tapered', 'slim-fit', 'slim fit', 'narrow'],
  straight:  ['straight', 'regular', 'classic', 'standard'],
  relaxed:   ['relaxed', 'loose', 'easy', 'comfort', 'wide', 'wide-leg', 'slouch'],
  oversized: ['oversized', 'oversized-fit', 'baggy', 'boxy', 'roomy', 'dropped'],
  cropped:   ['cropped', 'crop', 'short'],
};
