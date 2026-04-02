import { z } from 'zod';

import { openAiClient } from '../../ai/openai-client.js';
import { HttpError } from '../../lib/http-error.js';
import { closetRepository } from './closet.repository.js';
import { closetSketchService } from './closet-sketch.service.js';
import type {
  AnalyzeClosetItemPayload,
  ClosetMatchPayload,
  GenerateClosetSketchPayload,
  SaveClosetItemPayload,
  UpdateClosetItemPayload,
} from './closet.validation.js';

const analyzeResponseSchema = z.object({
  title: z.string(),
  category: z.string(),
});

const matchResponseSchema = z.object({
  matches: z.array(
    z.object({
      suggestionIndex: z.number(),
      matchedItemId: z.string().nullable(),
    })
  ),
});

// ── Category compatibility groups ─────────────────────────────────────────────
// Items in the same group are category-compatible for matching purposes.
// Keep groups broad enough for wardrobe matching, but distinct enough to
// avoid cross-type false positives (sneakers vs dress shoes, trousers vs shorts).

const MATCH_CATEGORY_GROUPS: Record<string, string[]> = {
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

const MATCH_COLOR_FAMILIES: Record<string, string[]> = {
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

function buildMatchingVocabulary(): string {
  const categoryText = Object.entries(MATCH_CATEGORY_GROUPS)
    .map(([group, terms]) => `  ${group}: ${terms.join(', ')}`)
    .join('\n');

  const colorText = Object.entries(MATCH_COLOR_FAMILIES)
    .map(([family, terms]) => `  ${family}: ${terms.join(', ')}`)
    .join('\n');

  return `CATEGORY GROUPS (items in the same group are category-compatible):\n${categoryText}\n\nCOLOR FAMILIES (colors in the same family are color-compatible):\n${colorText}`;
}

// ── Sensitivity-driven color rules ────────────────────────────────────────────
// Converts a 0-100 slider value into specific color-tolerance instructions
// injected into the LLM prompt. Category matching is always strict regardless
// of sensitivity; only color/shade tolerance changes.

type SensitivityTier = 'LOW' | 'MEDIUM' | 'HIGH';

function sensitivityTier(value: number): SensitivityTier {
  if (value >= 67) return 'HIGH';
  if (value >= 34) return 'MEDIUM';
  return 'LOW';
}

function buildSensitivityInstructions(tier: SensitivityTier): string {
  if (tier === 'HIGH') {
    return `COLOR GATE — HIGH sensitivity (precise):
Items must be in the same COLOR FAMILY. Additionally, require similar tone/shade within the family:
  - Light blues (sky blue, powder blue, light blue) should match light blues, not dark blues (royal blue, cobalt)
  - Light greys (heather grey, silver, ash) should match light greys, not charcoal or graphite
  - Dark navy should match dark navy or midnight blue, not general blue
  - The STONE family can remain broad (stone, taupe, khaki, beige are all similar enough)
If the best same-category item has a noticeably different shade within the family, return null.
Only match when confident about BOTH category AND color shade.`;
  }

  if (tier === 'MEDIUM') {
    return `COLOR GATE — MEDIUM sensitivity (balanced):
Items must be in the same COLOR FAMILY.
Within a family, all shades are compatible — light grey and charcoal are both GREY; stone and taupe are both STONE.
NAVY and BLUE are different families — do not match them.
If no same-category item is in the same COLOR FAMILY, return null.`;
  }

  // LOW
  return `COLOR GATE — LOW sensitivity (forgiving):
Items must be in broadly the same color area. The families are intentionally broad — accept any shade variation within a family.
If the item has no color mentioned in its title, accept it as a neutral candidate (pass the color gate).
Be generous: if the color is in the general direction of the suggestion (e.g., both are warm neutrals, or both are cool blues), prefer matching over returning null.
Only return null when the colors are clearly on opposite ends of the spectrum (e.g., black vs white, navy vs orange).`;
}

function mapItem(item: {
  id: string;
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageUrl: string | null;
  sketchImageUrl: string | null;
  sketchStatus: string;
  savedAt: Date;
}) {
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    size: item.size,
    category: item.category,
    uploadedImageUrl: item.uploadedImageUrl,
    sketchImageUrl: item.sketchImageUrl,
    sketchStatus: item.sketchStatus,
    savedAt: item.savedAt.toISOString(),
  };
}

export const closetService = {
  async analyzeItem(payload: AnalyzeClosetItemPayload) {
    const userContent: Array<{ type: 'input_image'; image_url: string; detail?: 'high' } | { type: 'input_text'; text: string }> = [];

    if (payload.uploadedImageUrl) {
      userContent.push({ type: 'input_image', image_url: payload.uploadedImageUrl, detail: 'high' });
    }

    userContent.push({
      type: 'input_text',
      text: payload.uploadedImageUrl
        ? 'Identify this garment. Return a concise product-style title (e.g. "Chocolate Brown Corduroy Blazer") and the most specific category from: Suit, Blazer, Sports Jacket, Coat, Shirt, Polo, Knitwear, Cardigan, Hoodie, Trousers, Denim, Shorts, Shoes, Sneakers, Loafers, Boots, Belt, Bag, Watch, Scarf, Hat, Tie, Socks, Clothing.'
        : `Identify this garment from the description: "${payload.description ?? ''}". Return a concise product-style title and a specific category.`,
    });

    const result = await openAiClient.createStructuredResponse({
      schema: analyzeResponseSchema,
      jsonSchema: {
        name: 'closet_item_analysis',
        description: 'Identifies a garment title and category',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Concise product-style title, e.g. "Chocolate Brown Corduroy Blazer"' },
            category: { type: 'string', description: 'Single category name from the standard list' },
          },
          required: ['title', 'category'],
          additionalProperties: false,
        },
      },
      instructions: 'You are a menswear expert cataloguing a wardrobe. Identify garments accurately and concisely.',
      userContent,
    });

    return result;
  },

  async saveItem(payload: SaveClosetItemPayload) {
    const item = await closetRepository.createItem({
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
      uploadedImageUrl: payload.uploadedImageUrl,
      sketchImageUrl: payload.sketchImageUrl,
      sketchStatus: payload.sketchImageUrl ? 'ready' : 'failed',
    });
    return mapItem(item);
  },

  async getItems() {
    const items = await closetRepository.getItems();
    return { items: items.map(mapItem) };
  },

  async getItem(id: string) {
    const item = await closetRepository.getItem(id);
    if (!item) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    return mapItem(item);
  },

  async updateItem(id: string, payload: UpdateClosetItemPayload) {
    const existing = await closetRepository.getItem(id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    const updated = await closetRepository.updateItem(id, {
      title: payload.title,
      brand: payload.brand,
      size: payload.size,
      category: payload.category,
    });
    return mapItem(updated);
  },

  async deleteItem(id: string) {
    const existing = await closetRepository.getItem(id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Item not found.');
    await closetRepository.deleteItem(id);
    return { deleted: true };
  },

  async generateItemSketch(payload: GenerateClosetSketchPayload) {
    const jobId = await closetSketchService.startSketchJob(payload.uploadedImageUrl);
    return { jobId };
  },

  async getItemSketch(jobId: string) {
    const result = await closetSketchService.getSketchJobStatus(jobId);
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Sketch job not found.');
    return result;
  },

  async matchItems(payload: ClosetMatchPayload) {
    if (!payload.items.length) {
      return { matches: payload.suggestions.map((suggestion, i) => ({ suggestionIndex: i, suggestion, matchedItemId: null })) };
    }

    const itemList = payload.items
      .map((item) => `  - id: "${item.id}", title: "${item.title}", category: "${item.category}"${item.brand ? `, brand: "${item.brand}"` : ''}`)
      .join('\n');

    const suggestionList = payload.suggestions
      .map((s, i) => `  ${i}: "${s}"`)
      .join('\n');

    const matchingVocabulary = buildMatchingVocabulary();
    const tier = sensitivityTier(payload.sensitivity ?? 50);
    const colorInstructions = buildSensitivityInstructions(tier);

    const result = await openAiClient.createStructuredResponse({
      schema: matchResponseSchema,
      jsonSchema: {
        name: 'closet_match_result',
        description: 'Matches outfit suggestions to the user\'s owned closet items',
        schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  suggestionIndex: { type: 'number', description: 'Index of the suggestion (0-based)' },
                  matchedItemId: { type: ['string', 'null'], description: 'The id of the best matching closet item, or null if no item is in the same category group' },
                },
                required: ['suggestionIndex', 'matchedItemId'],
                additionalProperties: false,
              },
            },
          },
          required: ['matches'],
          additionalProperties: false,
        },
      },
      instructions: `You are a wardrobe matching assistant. For each outfit suggestion, follow these steps in exact order.

${matchingVocabulary}

━━━ STEP 1 — CATEGORY GATE (hard, no exceptions) ━━━
Identify which CATEGORY GROUP the outfit suggestion belongs to.
Keep only closet items that belong to the SAME CATEGORY GROUP.
Use the item's category field as the primary signal; fall back to the item's title only if the category is generic.
If ZERO items pass this gate → return null immediately. Do not proceed. Do not find the "nearest" item across groups.

Each group is distinct. POLO ≠ TEE. SNEAKERS ≠ LOAFERS. WATCH ≠ anything else. Crossing groups is never acceptable.

━━━ STEP 2 — COLOR GATE ━━━
Extract the dominant color word(s) from the suggestion text and find their COLOR FAMILY.
From the same-category candidates, keep only items whose title contains a color in the matching COLOR FAMILY.
Items with no color mentioned in their title: keep them as neutral candidates (they pass this gate).

If the suggestion has NO detectable color word → skip the color gate, proceed with all same-category candidates.
If every same-category candidate fails the color gate → return null.

${colorInstructions}

━━━ STEP 3 — SELECT BEST ━━━
Among items that passed both gates, pick the single best match:
  - prefer the closest garment sub-type (e.g. "trousers" item for a "trousers" suggestion over a "chinos" item)
  - then prefer the closest color within the family
Return that item's id.

━━━ WHAT SHOULD AND SHOULD NOT MATCH ━━━
✓ "tailored grey trousers" → "Grey Slim-Fit Chinos"  (TROUSERS + GREY)
✓ "stone chino trousers"  → "Beige Khaki Trousers"   (TROUSERS + STONE)
✓ "light blue dress shirt" → "Light Blue OCBD"        (DRESS_SHIRT + BLUE)
✓ "white crewneck tee"    → "White Cotton T-Shirt"    (TEE + WHITE)
✗ "light blue dress shirt" → "Navy Button-Up"          ✗ BLUE ≠ NAVY
✗ "white polo"            → "White T-Shirt"            ✗ POLO ≠ TEE
✗ "classic dress watch"   → any trouser/shirt/shoe     ✗ wrong category entirely`,
      userContent: [
        {
          type: 'input_text',
          text: `OUTFIT SUGGESTIONS (by index):\n${suggestionList}\n\nUSER'S CLOSET ITEMS:\n${itemList}\n\nReturn one match entry per suggestion index (0 through ${payload.suggestions.length - 1}). For each suggestion, pick the best available match using the rules above.`,
        },
      ],
    });

    return {
      matches: result.matches.map((m) => ({
        suggestionIndex: m.suggestionIndex,
        suggestion: payload.suggestions[m.suggestionIndex] ?? '',
        matchedItemId: m.matchedItemId,
      })),
    };
  },
};
