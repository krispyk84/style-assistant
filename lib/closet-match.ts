import type { ClosetItem } from '@/types/closet';

// ── Garment groups ─────────────────────────────────────────────────────────────
// Maps a canonical group key to every keyword that can appear in a
// free-text suggestion string or closet item title.

const GARMENT_GROUPS: Record<string, readonly string[]> = {
  trousers:     ['trouser', 'chino', 'slack', 'cord', 'gabardine'],
  denim:        ['jean', 'denim'],
  shorts:       ['short'],
  shirt:        ['shirt', 'oxford', 'button-down', 'button down', 'chambray', 'flannel'],
  polo:         ['polo'],
  tee:          ['tee', 't-shirt', 'tshirt'],
  knitwear:     ['sweater', 'knit', 'crewneck', 'merino', 'cashmere', 'jumper', 'pullover'],
  cardigan:     ['cardigan'],
  hoodie:       ['hoodie', 'sweatshirt'],
  blazer:       ['blazer', 'sports jacket', 'sport coat', 'sport jacket', 'sportcoat'],
  jacket:       ['jacket', 'overshirt', 'chore coat', 'chore', 'shacket', 'field jacket', 'trucker', 'harrington'],
  coat:         ['coat', 'topcoat', 'overcoat', 'trench', 'mac', 'raincoat'],
  suit:         ['suit'],
  sneakers:     ['sneaker', 'trainer', 'runner', 'canvas shoe', 'court shoe', 'plimsoll'],
  loafers:      ['loafer', 'penny loafer', 'moccasin', 'slip-on'],
  boots:        ['boot', 'chelsea', 'chukka', 'desert boot'],
  formal_shoes: ['oxford shoe', 'derby shoe', 'brogue', 'monk strap'],
  belt:         ['belt'],
  bag:          ['bag', 'tote', 'briefcase', 'backpack', 'satchel'],
  watch:        ['watch'],
  scarf:        ['scarf'],
  hat:          ['hat', 'cap', 'beanie', 'bucket hat'],
  tie:          ['tie', 'pocket square'],
  socks:        ['sock'],
};

// Maps the canonical category strings stored on ClosetItem → garment group keys.
// These match the values produced by mock-closet-service and the real API.
const CATEGORY_TO_GROUP: Record<string, string> = {
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
};

// Groups that are meaningfully related — allow partial category credit.
const RELATED_GROUP_SETS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['blazer', 'jacket', 'coat']),
  new Set(['shirt', 'polo', 'tee']),
  new Set(['trousers', 'denim', 'shorts']),
  new Set(['sneakers', 'loafers', 'boots', 'formal_shoes']),
];

// ── Color families ─────────────────────────────────────────────────────────────

const COLOR_FAMILIES: Record<string, readonly string[]> = {
  white:    ['white', 'cream', 'ivory', 'ecru', 'off-white', 'chalk', 'bone', 'milk', 'optical white'],
  stone:    ['stone', 'khaki', 'beige', 'sand', 'tan', 'oatmeal', 'wheat', 'natural', 'linen', 'taupe', 'putty', 'parchment'],
  camel:    ['camel', 'caramel', 'biscuit'],
  grey:     ['grey', 'gray', 'silver', 'heather', 'slate', 'ash', 'charcoal', 'graphite', 'marl'],
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

// ── Scoring weights ────────────────────────────────────────────────────────────

const SCORE_GROUP_EXACT   = 50; // same garment category
const SCORE_GROUP_RELATED = 15; // related garment category (e.g. blazer ↔ jacket)
const SCORE_GROUP_UNKNOWN =  5; // one side has no detectable garment type
const SCORE_COLOR_MATCH   = 35; // at least one shared color family
const SCORE_KEYWORD_EACH  =  5; // per shared significant word (max 20)
const SCORE_KEYWORD_MAX   = 20;

// A match must reach this score to show a checkmark.
// Requires at minimum: exact group + color, or exact group + 2 keyword hits.
const CONFIDENCE_THRESHOLD = 60;

// ── Text utilities ─────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractGarmentGroup(text: string): string | null {
  const norm = normalizeText(text);
  for (const [group, keywords] of Object.entries(GARMENT_GROUPS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) return group;
    }
  }
  return null;
}

function getItemGarmentGroup(item: ClosetItem): string | null {
  const fromCategory = CATEGORY_TO_GROUP[item.category];
  if (fromCategory) return fromCategory;
  // Fall back to parsing the item's title for cases where category is generic
  return extractGarmentGroup(item.title);
}

function isRelatedGroup(a: string, b: string): boolean {
  return RELATED_GROUP_SETS.some((set) => set.has(a) && set.has(b));
}

function extractColorFamilies(text: string): Set<string> {
  const norm = normalizeText(text);
  const result = new Set<string>();
  for (const [family, keywords] of Object.entries(COLOR_FAMILIES)) {
    if (keywords.some((kw) => norm.includes(kw))) {
      result.add(family);
    }
  }
  return result;
}

// Words worth comparing — long enough, not generic styling/garment stop-words
const KEYWORD_STOP_WORDS = new Set([
  'with', 'that', 'this', 'from', 'your', 'have', 'been', 'will',
  'colour', 'color', 'style', 'wear', 'piece', 'item', 'look',
  'fitted', 'fitting', 'slim', 'classic', 'tailored', 'relaxed',
  'light', 'dark', 'deep', 'pale', 'rich', 'toned',
]);

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 3 && !KEYWORD_STOP_WORDS.has(w))
  );
}

// ── Match scoring ──────────────────────────────────────────────────────────────

function scoreMatch(suggestion: string, item: ClosetItem): number {
  const suggGroup = extractGarmentGroup(suggestion);
  const itemGroup = getItemGarmentGroup(item);

  let groupScore = 0;

  if (suggGroup && itemGroup) {
    if (suggGroup === itemGroup) {
      groupScore = SCORE_GROUP_EXACT;
    } else if (isRelatedGroup(suggGroup, itemGroup)) {
      groupScore = SCORE_GROUP_RELATED;
    } else {
      // Hard category mismatch — completely different garment types can never match
      return 0;
    }
  } else if (suggGroup !== itemGroup) {
    // One side has no detectable group — small neutral credit, let color/keywords decide
    groupScore = SCORE_GROUP_UNKNOWN;
  }
  // Both null: neither side has a detectable type; groupScore stays 0

  const suggColors = extractColorFamilies(suggestion);
  const itemColors = extractColorFamilies(item.title);
  const colorScore =
    suggColors.size > 0 && itemColors.size > 0 && [...suggColors].some((c) => itemColors.has(c))
      ? SCORE_COLOR_MATCH
      : 0;

  const suggWords = significantWords(suggestion);
  const itemWords = significantWords(item.title);
  const overlapCount = [...suggWords].filter((w) => itemWords.has(w)).length;
  const keywordScore = Math.min(SCORE_KEYWORD_MAX, overlapCount * SCORE_KEYWORD_EACH);

  return groupScore + colorScore + keywordScore;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the single best-matching closet item for the given outfit piece
 * suggestion string, or null if no item meets the confidence threshold.
 *
 * Scoring (max 105 pts, threshold 60):
 *   50 — exact garment category match
 *   15 — related garment category (e.g. blazer ↔ jacket)
 *    5 — one side has no detectable garment type (neutral credit)
 *   35 — at least one shared color family
 *  +5 per shared significant word, capped at 20
 */
export function findBestClosetMatch(suggestion: string, items: ClosetItem[]): ClosetItem | null {
  if (!items.length || !suggestion.trim()) return null;

  let bestItem: ClosetItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = scoreMatch(suggestion, item);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestScore >= CONFIDENCE_THRESHOLD ? bestItem : null;
}
