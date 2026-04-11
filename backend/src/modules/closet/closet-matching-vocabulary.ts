// ── Category compatibility groups ─────────────────────────────────────────────
// Items in the same group are category-compatible for matching purposes.
// Keep groups broad enough for wardrobe matching, but distinct enough to
// avoid cross-type false positives (sneakers vs dress shoes, trousers vs shorts).

export const MATCH_CATEGORY_GROUPS: Record<string, string[]> = {
  TROUSERS:     ['trouser', 'trousers', 'chino', 'chinos', 'slack', 'slacks', 'dress pants', 'dress pant', 'tailored pant', 'wool trouser', 'gabardine', 'khaki pant', 'khakis'],
  JEANS:        ['jean', 'jeans', 'denim', 'denim trouser'],
  SHORTS:       ['short', 'shorts', 'chino short', 'bermuda'],
  DRESS_SHIRT:  ['dress shirt', 'oxford shirt', 'ocbd', 'button-down', 'button down', 'button-up', 'spread collar', 'french cuff', 'poplin shirt', 'formal shirt', 'chambray shirt'],
  CASUAL_SHIRT: ['casual shirt', 'linen shirt', 'camp collar', 'resort shirt'],
  POLO:         ['polo', 'polo shirt'],
  TEE:          ['t-shirt', 'tee', 'crewneck tee', 'v-neck tee', 'long sleeve tee', 'long-sleeve t-shirt', 'graphic tee'],
  KNITWEAR:     ['sweater', 'knit', 'crewneck sweater', 'merino', 'cashmere', 'jumper', 'pullover', 'knitwear'],
  CARDIGAN:     ['cardigan'],
  HOODIE:       ['hoodie', 'sweatshirt', 'zip-up hoodie', 'fleece'],
  BLAZER:       ['blazer', 'sport coat', 'sports jacket', 'suit jacket'],
  JACKET:       ['jacket', 'chore coat', 'chore jacket', 'overshirt jacket', 'shacket', 'trucker jacket', 'harrington', 'field jacket', 'bomber jacket'],
  COAT:         ['coat', 'topcoat', 'overcoat', 'trench coat', 'raincoat', 'mac'],
  SUIT:         ['suit'],
  SNEAKERS:     ['sneaker', 'sneakers', 'trainer', 'trainers', 'runner', 'runners', 'court shoe', 'canvas shoe', 'plimsoll'],
  LOAFERS:      ['loafer', 'loafers', 'penny loafer', 'slip-on', 'moccasin'],
  BOOTS:        ['boot', 'boots', 'chelsea boot', 'chukka boot', 'desert boot', 'ankle boot'],
  DRESS_SHOES:  ['dress shoe', 'dress shoes', 'oxford shoe', 'derby shoe', 'brogue', 'monk strap', 'cap-toe'],
  BELT:         ['belt'],
  BAG:          ['bag', 'tote', 'briefcase', 'backpack', 'satchel'],
  WATCH:        ['watch'],
  SCARF:        ['scarf'],
  HAT:          ['hat', 'cap', 'beanie', 'bucket hat'],
  TIE:          ['tie', 'necktie', 'pocket square'],
  SOCKS:        ['sock', 'socks'],
};

// ── Broad color families ───────────────────────────────────────────────────────
// Intentionally broad — practical wardrobe matching, not exact taxonomy.
// Any two colors in the same family are considered color-compatible.

export const MATCH_COLOR_FAMILIES: Record<string, string[]> = {
  WHITE:    ['white', 'off-white', 'cream', 'ivory', 'ecru', 'chalk', 'optical white'],
  STONE:    ['stone', 'taupe', 'khaki', 'beige', 'sand', 'oatmeal', 'wheat', 'tan', 'linen', 'putty', 'camel', 'biscuit', 'light neutral', 'natural', 'parchment', 'greige'],
  GREY:     ['grey', 'gray', 'light grey', 'light gray', 'mid grey', 'mid gray', 'charcoal', 'graphite', 'slate', 'silver', 'heather', 'ash', 'heather grey', 'marl', 'steel', 'stainless', 'gunmetal'],
  BLACK:    ['black', 'jet', 'onyx', 'ebony', 'jet black'],
  NAVY:     ['navy', 'midnight blue', 'dark blue', 'ink blue', 'naval'],
  BLUE:     ['blue', 'light blue', 'cobalt', 'royal blue', 'sky blue', 'powder blue', 'cornflower', 'cerulean', 'electric blue'],
  BROWN:    ['brown', 'chocolate', 'cognac', 'tobacco', 'walnut', 'chestnut', 'caramel', 'mahogany', 'mocha', 'coffee', 'dark tan', 'whiskey'],
  OLIVE:    ['olive', 'army green', 'military green', 'moss', 'khaki green', 'dark olive'],
  GREEN:    ['green', 'forest green', 'sage', 'emerald', 'bottle green', 'hunter green', 'pine', 'sage green'],
  BURGUNDY: ['burgundy', 'wine', 'bordeaux', 'oxblood', 'garnet', 'claret', 'merlot'],
  RED:      ['red', 'crimson', 'scarlet', 'tomato'],
  PINK:     ['pink', 'blush', 'rose', 'dusty pink', 'mauve', 'salmon'],
  YELLOW:   ['yellow', 'mustard', 'amber', 'gold', 'ochre'],
  PURPLE:   ['purple', 'violet', 'lavender', 'lilac', 'plum'],
  RUST:     ['rust', 'terra cotta', 'terracotta', 'sienna', 'burnt orange'],
};

export function buildMatchingVocabulary(): string {
  const categoryText = Object.entries(MATCH_CATEGORY_GROUPS)
    .map(([group, terms]) => `  ${group}: ${terms.join(', ')}`)
    .join('\n');

  const colorText = Object.entries(MATCH_COLOR_FAMILIES)
    .map(([family, terms]) => `  ${family}: ${terms.join(', ')}`)
    .join('\n');

  return `CATEGORY GROUPS (items in the same group are category-compatible):\n${categoryText}\n\nCOLOR FAMILIES (colors in the same family are color-compatible):\n${colorText}`;
}
