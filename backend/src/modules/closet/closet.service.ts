import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { openAiClient } from '../../ai/openai-client.js';
import { storageConfig } from '../../config/storage.js';
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
  brand: z.string(),
  subcategory: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  colorFamily: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  formality: z.string().nullable().optional(),
  silhouette: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
});

const matchResponseSchema = z.object({
  matches: z.array(
    z.object({
      suggestionIndex: z.number(),
      matchedItemId: z.string().nullable(),
    })
  ),
});

// ── OutfitPieceCategory → closet item category mapping ────────────────────────
// Maps the structured category enum (from the LLM's structured output) to the
// closet item category strings stored in the DB. Used to pre-filter candidates
// before the LLM matching step so category is a hard gate, not inferred from text.

const OUTFIT_TO_CLOSET_CATEGORY_MAP: Record<string, string[]> = {
  Bag:               ['Bag'],
  Belt:              ['Belt'],
  Blazer:            ['Blazer', 'Sports Jacket'],
  Boots:             ['Boots'],
  Cardigan:          ['Cardigan'],
  Coat:              ['Coat'],
  Denim:             ['Denim'],
  Gloves:            ['Gloves'],
  Hoodie:            ['Hoodie'],
  Knitwear:          ['Knitwear'],
  Loafers:           ['Loafers'],
  Outerwear:         ['Outerwear', 'Jacket'],
  Overshirt:         ['Overshirt'],
  Polo:              ['Polo'],
  Scarf:             ['Scarf'],
  Shirt:             ['Shirt'],
  Shoes:             ['Shoes'],
  Shorts:            ['Shorts'],
  Sneakers:          ['Sneakers'],
  Suit:              ['Suit'],
  Sunglasses:        ['Sunglasses'],
  Sweatpants:        ['Sweatpants'],
  Sweatshirt:        ['Sweatshirt'],
  'Swim Shirt':      ['Swim Shirt'],
  'Swimming Shorts': ['Swimming Shorts', 'Shorts'],
  'T-Shirt':         ['T-Shirt'],
  'Tank Top':        ['Tank Top'],
  Trousers:          ['Trousers'],
  Vest:              ['Vest'],
  Watch:             ['Watch'],
};

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
  subcategory?: string | null;
  primaryColor?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  weight?: string | null;
  pattern?: string | null;
  notes?: string | null;
  fitStatus?: string | null;
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
    subcategory: item.subcategory ?? undefined,
    primaryColor: item.primaryColor ?? undefined,
    colorFamily: item.colorFamily ?? undefined,
    material: item.material ?? undefined,
    formality: item.formality ?? undefined,
    silhouette: item.silhouette ?? undefined,
    season: item.season ?? undefined,
    weight: item.weight ?? undefined,
    pattern: item.pattern ?? undefined,
    notes: item.notes ?? undefined,
    fitStatus: item.fitStatus ?? undefined,
  };
}

// ── analyzeItem prompt vocabulary (static — defined once at module scope) ──────

const ANALYZE_CATEGORY_LIST = 'Suit, Blazer, Sports Jacket, Coat, Shirt, Polo, Knitwear, Cardigan, Hoodie, Trousers, Denim, Shorts, Shoes, Sneakers, Loafers, Boots, Belt, Bag, Watch, Scarf, Hat, Tie, Socks, Clothing';
const ANALYZE_FORMALITY_OPTIONS = 'Casual, Smart Casual, Refined Casual, Formal';
const ANALYZE_SILHOUETTE_OPTIONS = 'slim, straight, relaxed, oversized, cropped';
const ANALYZE_COLOR_FAMILY_OPTIONS = 'white, stone, grey, black, navy, blue, brown, olive, green, burgundy, red, pink, yellow, purple, rust, camel';
const ANALYZE_WEIGHT_OPTIONS = 'Lightweight, Midweight, Heavyweight';
const ANALYZE_PATTERN_OPTIONS = 'Solid, Stripe, Check, Plaid, Print, Texture, Other';

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  // Prefer reading directly from disk — faster and avoids self-HTTP requests on Render.
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      const ext = path.extname(storageKey).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      // File not on disk — fall through to HTTP fetch
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image fetch failed with HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

export const closetService = {
  async analyzeItem(payload: AnalyzeClosetItemPayload) {
    const userContent: Array<{ type: 'input_image'; image_url: string; detail?: 'high' } | { type: 'input_text'; text: string }> = [];

    if (payload.uploadedImageUrl) {
      const dataUrl = await imageUrlToDataUrl(payload.uploadedImageUrl);
      userContent.push({ type: 'input_image', image_url: dataUrl, detail: 'high' });
    }

    userContent.push({
      type: 'input_text',
      text: payload.uploadedImageUrl
        ? `Identify this garment and return structured metadata. Categories: ${ANALYZE_CATEGORY_LIST}. Formality: ${ANALYZE_FORMALITY_OPTIONS}. Silhouette: ${ANALYZE_SILHOUETTE_OPTIONS}. ColorFamily: ${ANALYZE_COLOR_FAMILY_OPTIONS}. Weight: ${ANALYZE_WEIGHT_OPTIONS}. Pattern: ${ANALYZE_PATTERN_OPTIONS}. Return all fields — use empty string for brand if not detectable. Omit fields that cannot be determined from the image.`
        : `Identify this garment from the description: "${payload.description ?? ''}". Return structured metadata including title, category, and any detectable metadata fields. Brand: empty string if not apparent.`,
    });

    const result = await openAiClient.createStructuredResponse({
      schema: analyzeResponseSchema,
      jsonSchema: {
        name: 'closet_item_analysis',
        description: 'Identifies a garment and returns structured wardrobe metadata',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title:        { type: 'string', description: 'Concise product-style title, e.g. "Chocolate Brown Corduroy Blazer"' },
            category:     { type: 'string', description: `Single category name from: ${ANALYZE_CATEGORY_LIST}` },
            brand:        { type: 'string', description: 'Brand name if clearly identifiable from logos, tags, or visible text; empty string if not detectable' },
            subcategory:  { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'More specific sub-type, e.g. "Slim Chino", "Chelsea Boot", "Crewneck Sweater". Null if not determinable.' },
            primaryColor: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Primary color name, e.g. "Navy", "Chocolate Brown", "Stone". Null if not determinable.' },
            colorFamily:  { anyOf: [{ type: 'string' }, { type: 'null' }], description: `Broad color family for matching: ${ANALYZE_COLOR_FAMILY_OPTIONS}. Null if not determinable.` },
            material:     { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Primary fabric or material, e.g. "Wool", "Cotton", "Denim", "Cashmere". Null if not determinable.' },
            formality:    { anyOf: [{ type: 'string' }, { type: 'null' }], description: `Formality level: ${ANALYZE_FORMALITY_OPTIONS}. Null if not determinable.` },
            silhouette:   { anyOf: [{ type: 'string' }, { type: 'null' }], description: `Garment's design cut: ${ANALYZE_SILHOUETTE_OPTIONS}. Null if not determinable.` },
            weight:       { anyOf: [{ type: 'string' }, { type: 'null' }], description: `Fabric weight: ${ANALYZE_WEIGHT_OPTIONS}. Null if not determinable.` },
            pattern:      { anyOf: [{ type: 'string' }, { type: 'null' }], description: `Surface pattern: ${ANALYZE_PATTERN_OPTIONS}. Null if not determinable.` },
          },
          required: ['title', 'category', 'brand', 'subcategory', 'primaryColor', 'colorFamily', 'material', 'formality', 'silhouette', 'weight', 'pattern'],
        },
      },
      instructions: 'You are a menswear expert cataloguing a wardrobe. Identify garments accurately. Return all metadata you can confidently determine from the image. Only return a brand if you can see it clearly — from logos, embroidery, labels, or printed text. Never guess a brand.',
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
      subcategory: payload.subcategory,
      primaryColor: payload.primaryColor,
      colorFamily: payload.colorFamily,
      material: payload.material,
      formality: payload.formality,
      silhouette: payload.silhouette,
      season: payload.season,
      weight: payload.weight,
      pattern: payload.pattern,
      notes: payload.notes,
      fitStatus: payload.fitStatus,
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
      subcategory: payload.subcategory,
      primaryColor: payload.primaryColor,
      colorFamily: payload.colorFamily,
      material: payload.material,
      formality: payload.formality,
      silhouette: payload.silhouette,
      season: payload.season,
      weight: payload.weight,
      pattern: payload.pattern,
      notes: payload.notes,
      fitStatus: payload.fitStatus,
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
      return {
        matches: payload.suggestions.map((s, i) => ({
          suggestionIndex: i,
          suggestion: s.display_name,
          matchedItemId: null,
        })),
      };
    }

    const excludeSet = new Set(payload.excludeItemIds ?? []);
    const availableItems = excludeSet.size
      ? payload.items.filter((item) => !excludeSet.has(item.id))
      : payload.items;

    // Pre-filter candidates per suggestion using metadata.category when available.
    // This makes category a hard application-layer gate before the LLM even runs.
    const candidatesPerSuggestion = payload.suggestions.map((s) => {
      if (!s.category) return availableItems;
      const compatibleCategories = OUTFIT_TO_CLOSET_CATEGORY_MAP[s.category];
      if (!compatibleCategories) return availableItems;
      const filtered = availableItems.filter((item) => compatibleCategories.includes(item.category));
      // If no items survive the category filter, return empty (LLM should return null)
      return filtered;
    });

    // Build a flat deduplicated item list containing only candidates that appear
    // in at least one suggestion's candidate set.
    const candidateItemIds = new Set(candidatesPerSuggestion.flatMap((c) => c.map((i) => i.id)));
    const itemsForLlm = availableItems.filter((item) => candidateItemIds.has(item.id));

    if (!itemsForLlm.length) {
      return {
        matches: payload.suggestions.map((s, i) => ({
          suggestionIndex: i,
          suggestion: s.display_name,
          matchedItemId: null,
        })),
      };
    }

    const itemList = itemsForLlm
      .map((item) => {
        let line = `  - id: "${item.id}", title: "${item.title}", category: "${item.category}"`;
        if (item.brand) line += `, brand: "${item.brand}"`;
        if (item.colorFamily) line += `, colorFamily: "${item.colorFamily}"`;
        if (item.material) line += `, material: "${item.material}"`;
        if (item.formality) line += `, formality: "${item.formality}"`;
        return line;
      })
      .join('\n');

    // Annotate each suggestion with its category and color metadata when available.
    const suggestionList = payload.suggestions
      .map((s, i) => {
        const meta = s.category
          ? ` [category: ${s.category}${s.color ? `; color: ${s.color}` : ''}]`
          : '';
        const eligibleIds = candidatesPerSuggestion[i]!.map((c) => c.id);
        const eligibleNote = s.category
          ? ` [eligible item ids: ${eligibleIds.length ? eligibleIds.join(', ') : 'none — return null'}]`
          : '';
        return `  ${i}: "${s.display_name}"${meta}${eligibleNote}`;
      })
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
                  matchedItemId: { type: ['string', 'null'], description: 'The id of the best matching closet item, or null if no suitable match exists' },
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

IMPORTANT: Each suggestion may include a [category: X] annotation and an [eligible item ids: ...] list. When these are present, you MUST only consider items in the eligible list — this is the pre-filtered set of items in the correct category. If the eligible list says "none — return null", return null immediately without considering any other items.

${matchingVocabulary}

━━━ STEP 1 — CATEGORY GATE (hard, no exceptions) ━━━
If the suggestion has [eligible item ids: ...]: use ONLY those items. Do not consider items outside this list.
If the suggestion has no [category:] annotation: identify the category from text using the CATEGORY GROUPS above.
If ZERO items pass this gate → return null immediately.

━━━ STEP 2 — COLOR GATE ━━━
Use the [color: X] annotation if present, otherwise extract color from the suggestion text.
Find the COLOR FAMILY for that color.
For each candidate item: if it has a [colorFamily: X] field, use that directly as its color family (authoritative — do not infer from title). Otherwise, extract color from the item's title.
Keep only same-category candidates whose color family matches.
Items with no detectable color (no colorFamily field and no color in title) are neutral candidates (they pass this gate).

If the suggestion has NO detectable color → skip the color gate.
If every same-category candidate fails the color gate → return null.

${colorInstructions}

━━━ STEP 3 — SELECT BEST ━━━
Among items that passed both gates, pick the single best match:
  - prefer the closest garment sub-type
  - then prefer the closest color within the family
Return that item's id.`,
      userContent: [
        {
          type: 'input_text',
          text: `OUTFIT SUGGESTIONS (by index):\n${suggestionList}\n\nUSER'S CLOSET ITEMS (pre-filtered to eligible categories):\n${itemList}\n\nReturn one match entry per suggestion index (0 through ${payload.suggestions.length - 1}). Respect the [eligible item ids] constraint strictly — if a suggestion's eligible list is empty, return null for it.`,
        },
      ],
    });

    return {
      matches: result.matches.map((m) => ({
        suggestionIndex: m.suggestionIndex,
        suggestion: payload.suggestions[m.suggestionIndex]?.display_name ?? '',
        matchedItemId: m.matchedItemId,
      })),
    };
  },
};
