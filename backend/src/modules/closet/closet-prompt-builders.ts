import type { AnalyzeClosetItemPayload, ClosetMatchPayload } from './closet.validation.js';
import { buildMatchingVocabulary } from './closet-matching-vocabulary.js';
import { sensitivityTier, buildSensitivityInstructions } from './closet-sensitivity-rules.js';

type MatchItem = ClosetMatchPayload['items'][number];
type MatchSuggestion = ClosetMatchPayload['suggestions'][number];

// ── analyzeItem prompt vocabulary (static — defined once at module scope) ──────

const ANALYZE_CATEGORY_LIST = 'Suit, Blazer, Sports Jacket, Coat, Shirt, Polo, Knitwear, Cardigan, Hoodie, Trousers, Denim, Shorts, Shoes, Sneakers, Loafers, Boots, Belt, Bag, Watch, Scarf, Hat, Tie, Socks, Clothing';
const ANALYZE_FORMALITY_OPTIONS = 'Casual, Smart Casual, Refined Casual, Formal';
const ANALYZE_SILHOUETTE_OPTIONS = 'slim, straight, relaxed, oversized, cropped';
const ANALYZE_COLOR_FAMILY_OPTIONS = 'white, stone, grey, black, navy, blue, brown, olive, green, burgundy, red, pink, yellow, purple, rust, camel';
const ANALYZE_WEIGHT_OPTIONS = 'Lightweight, Midweight, Heavyweight';
const ANALYZE_PATTERN_OPTIONS = 'Solid, Stripe, Check, Plaid, Print, Texture, Other';

export const ANALYZE_INSTRUCTIONS = 'You are a menswear expert cataloguing a wardrobe. Identify garments accurately. Return all metadata you can confidently determine from the image. Only return a brand if you can see it clearly — from logos, embroidery, labels, or printed text. Never guess a brand.';

type AnalyzeContentBlock =
  | { type: 'input_image'; image_url: string; detail?: 'high' }
  | { type: 'input_text'; text: string };

export function buildAnalyzeUserContent(
  payload: AnalyzeClosetItemPayload,
  resolvedDataUrl: string | null,
): AnalyzeContentBlock[] {
  const userContent: AnalyzeContentBlock[] = [];

  if (resolvedDataUrl) {
    userContent.push({ type: 'input_image', image_url: resolvedDataUrl, detail: 'high' });
  }

  userContent.push({
    type: 'input_text',
    text: resolvedDataUrl
      ? `Identify this garment and return structured metadata. Categories: ${ANALYZE_CATEGORY_LIST}. Formality: ${ANALYZE_FORMALITY_OPTIONS}. Silhouette: ${ANALYZE_SILHOUETTE_OPTIONS}. ColorFamily: ${ANALYZE_COLOR_FAMILY_OPTIONS}. Weight: ${ANALYZE_WEIGHT_OPTIONS}. Pattern: ${ANALYZE_PATTERN_OPTIONS}. Return all fields — use empty string for brand if not detectable. Omit fields that cannot be determined from the image.`
      : `Identify this garment from the description: "${payload.description ?? ''}". Return structured metadata including title, category, and any detectable metadata fields. Brand: empty string if not apparent.`,
  });

  return userContent;
}

export function buildAnalyzeJsonSchema() {
  return {
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
  };
}

export function buildMatchJsonSchema() {
  return {
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
  };
}

export function buildMatchUserContent(
  itemsForLlm: MatchItem[],
  suggestions: MatchSuggestion[],
  candidatesPerSuggestion: MatchItem[][],
): Array<{ type: 'input_text'; text: string }> {
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

  const suggestionList = suggestions
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

  return [
    {
      type: 'input_text',
      text: `OUTFIT SUGGESTIONS (by index):\n${suggestionList}\n\nUSER'S CLOSET ITEMS (pre-filtered to eligible categories):\n${itemList}\n\nReturn one match entry per suggestion index (0 through ${suggestions.length - 1}). Respect the [eligible item ids] constraint strictly — if a suggestion's eligible list is empty, return null for it.`,
    },
  ];
}

export function buildMatchInstructions(sensitivity: number | undefined): string {
  const matchingVocabulary = buildMatchingVocabulary();
  const tier = sensitivityTier(sensitivity ?? 50);
  const colorInstructions = buildSensitivityInstructions(tier);

  return `You are a wardrobe matching assistant. For each outfit suggestion, follow these steps in exact order.

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
Return that item's id.`;
}
