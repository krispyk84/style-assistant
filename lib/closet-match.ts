/**
 * Closet matching engine.
 *
 * Architecture: deterministic weighted metadata scorer.
 * Accepts a structured OutfitPiece (with category/color/formality/material metadata)
 * and scores every candidate ClosetItem across multiple dimensions.
 *
 * Scoring order of precedence (strongest → weakest):
 *   1. Category  — hard gate; unrelated categories score zero
 *   2. Subcategory fuzzy — token set similarity on item.subcategory vs piece description
 *   3. Color family — structured colorFamily beats text inference
 *   4. Material — keyword groups + fuzzy text
 *   5. Formality — tier-distance scoring with adjacency bonus
 *   6. Silhouette — item.silhouette vs piece description keywords
 *   7. Title fuzzy — Jaccard token similarity as a tie-breaker
 *   8. Fit status — personal fit penalty for ill-fitting items
 *
 * Fuzzy matching: Jaccard token similarity (≈ RapidFuzz token_set_ratio).
 * Used only for subcategory, material, and title — as supporting signals,
 * never to overpower category logic.
 */

import type { ClosetItem } from '@/types/closet';
import type { OutfitPiece, OutfitPieceCategory } from '@/types/look-request';
import { normalizePiece, OUTFIT_TO_CLOSET_CATEGORY_MAP } from '@/types/look-request';

// ── Scoring weights ────────────────────────────────────────────────────────────

const W = {
  // Category
  CATEGORY_STRUCTURED:  70,  // piece.metadata.category → OUTFIT_TO_CLOSET_CATEGORY_MAP confirms
  CATEGORY_INFERRED:    55,  // text-inferred groups match
  CATEGORY_RELATED:     30,  // adjacent groups (blazer ↔ jacket, shirt ↔ polo)
  CATEGORY_UNKNOWN:      5,  // one side unknown — neutral credit

  // Subcategory (Jaccard token similarity against piece description)
  SUBCATEGORY_HIGH:     25,  // Jaccard ≥ 0.50
  SUBCATEGORY_MED:      12,  // Jaccard ≥ 0.28

  // Color
  COLOR_STRUCTURED:     22,  // item.colorFamily (authoritative) matches piece color family
  COLOR_TEXT:           12,  // text-inferred color families match

  // Material
  MATERIAL_EXACT:       16,  // same material group (wool/merino = same group)
  MATERIAL_FUZZY:        8,  // Jaccard ≥ 0.40 on material text

  // Formality (piece.metadata.formality vs item.formality)
  FORMALITY_EXACT:      14,
  FORMALITY_ADJACENT:    5,  // 1 tier apart
  FORMALITY_FAR:        -8,  // ≥ 2 tiers apart (Formal vs Casual)

  // Silhouette (item.silhouette vs piece description keywords)
  SILHOUETTE_MATCH:      8,

  // Title fuzzy — tie-breaker only
  TITLE_HIGH:           11,  // Jaccard ≥ 0.50
  TITLE_MED:             5,  // Jaccard ≥ 0.30

  // Fit penalty
  FITSTAT_POOR:         -5,  // too-tight | fits-large | needs-alteration
  FITSTAT_TAILORED:      3,  // tailored — confirmed good fit
};

// Minimum score for a match to be shown.
// Category alone (70 structured / 55 inferred) always passes.
// Related-category (30) requires at least one supporting signal.
const THRESHOLD = 50;

/**
 * Practical maximum score for a well-matched item.
 * Used to normalise raw scores into a 0–100 % confidence value.
 * (70 cat + 22 color + 16 material + 14 formality + 8 sub/silhouette = 130)
 */
export const MATCH_SCORE_MAX = 130;

// ── Garment group taxonomy ─────────────────────────────────────────────────────
// Maps free text to canonical group keys, used when metadata category is absent.

const GARMENT_GROUPS: Record<string, readonly string[]> = {
  trousers:     ['trouser', 'chino', 'slack', 'cord', 'gabardine'],
  denim:        ['jean', 'denim'],
  shorts:       ['short'],
  shirt:        ['shirt', 'oxford shirt', 'button-down', 'button down', 'chambray', 'flannel', 'dress shirt', 'spread collar', 'french cuff'],
  polo:         ['polo'],
  tee:          ['tee', 't-shirt', 'tshirt', 'long sleeve', 'rash guard', 'performance shirt', 'swim shirt', 'base layer'],
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
  formal_shoes: ['oxford shoe', 'derby shoe', 'brogue', 'monk strap', 'oxford', 'oxfords', 'cap-toe', 'cap toe', 'dress shoe'],
  belt:         ['belt'],
  bag:          ['bag', 'tote', 'briefcase', 'backpack', 'satchel'],
  watch:        ['watch'],
  scarf:        ['scarf'],
  hat:          ['hat', 'cap', 'beanie', 'bucket hat'],
  tie:          ['tie', 'pocket square'],
  socks:        ['sock'],
};

// Maps stored ClosetItem.category → garment group key.
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
};

// Maps OutfitPieceCategory → garment group key for related-group checks.
const OUTFIT_CATEGORY_TO_GROUP: Partial<Record<OutfitPieceCategory, string>> = {
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
const RELATED_GROUP_SETS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['blazer', 'jacket', 'coat']),
  new Set(['shirt', 'polo']),
  new Set(['trousers', 'denim', 'shorts']),
  new Set(['sneakers', 'loafers', 'boots', 'formal_shoes']),
  new Set(['knitwear', 'cardigan', 'hoodie']),
];

// ── Color families ─────────────────────────────────────────────────────────────

const COLOR_FAMILIES: Record<string, readonly string[]> = {
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

const MATERIAL_GROUPS: Record<string, readonly string[]> = {
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

const FORMALITY_RANK: Record<string, number> = {
  'Casual':         0,
  'Smart Casual':   1,
  'Refined Casual': 2,
  'Formal':         3,
};

// ── Silhouette hint vocabulary ─────────────────────────────────────────────────

const SILHOUETTE_HINTS: Record<string, readonly string[]> = {
  slim:      ['slim', 'fitted', 'skinny', 'tapered', 'slim-fit', 'slim fit', 'narrow'],
  straight:  ['straight', 'regular', 'classic', 'standard'],
  relaxed:   ['relaxed', 'loose', 'easy', 'comfort', 'wide', 'wide-leg', 'slouch'],
  oversized: ['oversized', 'oversized-fit', 'baggy', 'boxy', 'roomy', 'dropped'],
  cropped:   ['cropped', 'crop', 'short'],
};

// ── Text utilities ─────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Jaccard token similarity — equivalent to RapidFuzz `token_set_ratio` for short garment texts.
 * Returns 0–1; higher = more similar.
 * Used as a supporting signal only: never overrides category logic.
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(normalizeText(s).split(/\s+/).filter((w) => w.length > 2));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
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
  return CATEGORY_TO_GROUP[item.category] ?? extractGarmentGroup(item.title);
}

function isRelatedGroup(a: string, b: string): boolean {
  return RELATED_GROUP_SETS.some((s) => s.has(a) && s.has(b));
}

function extractColorFamilies(text: string): Set<string> {
  const norm = normalizeText(text);
  const result = new Set<string>();
  for (const [family, keywords] of Object.entries(COLOR_FAMILIES)) {
    if (keywords.some((kw) => norm.includes(kw))) result.add(family);
  }
  return result;
}

function getMaterialGroup(text: string): string | null {
  const norm = normalizeText(text);
  for (const [group, keywords] of Object.entries(MATERIAL_GROUPS)) {
    if (keywords.some((kw) => norm.includes(kw))) return group;
  }
  return null;
}

const DRESS_SHIRT_SIGNALS = ['dress shirt', 'spread collar', 'french cuff', 'oxford shirt', 'formal shirt'];
const TEE_SIGNALS         = ['tee', 't-shirt', 'tshirt', 'long sleeve', 'long-sleeve'];

function isDressShirt(text: string): boolean {
  const n = text.toLowerCase();
  return DRESS_SHIRT_SIGNALS.some((s) => n.includes(s));
}

function isTee(text: string): boolean {
  const n = text.toLowerCase();
  return TEE_SIGNALS.some((s) => n.includes(s));
}

// ── Scoring dimensions ─────────────────────────────────────────────────────────

export type MatchDimensions = {
  category: number;
  subcategory: number;
  color: number;
  material: number;
  formality: number;
  silhouette: number;
  fuzzyTitle: number;
  fitPenalty: number;
};

export type MatchScore = {
  total: number;
  passesThreshold: boolean;
  /** 0–100 confidence percentage derived from total / MATCH_SCORE_MAX. */
  confidencePercent: number;
  dimensions: MatchDimensions;
  /** Short reason codes — useful for logging and future tuning. */
  reasons: string[];
};

function scoreCategory(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  // ── Structured metadata path ───────────────────────────────────────────────
  if (piece.metadata?.category) {
    const cat = piece.metadata.category;

    // Text-veto: if the display_name text implies a group that is incompatible
    // with the metadata category, the LLM assigned a wrong category (e.g. "navy
    // tie" labelled as Belt). Trust the text over the structured field.
    const textGroup  = extractGarmentGroup(piece.display_name.replace(/\(.*?\)/g, '').trim());
    const metaGroup  = OUTFIT_CATEGORY_TO_GROUP[cat];
    if (textGroup && metaGroup && textGroup !== metaGroup && !isRelatedGroup(textGroup, metaGroup)) {
      // Fall through to the text-inference path below by pretending there is no
      // metadata category — do NOT return 0 here, a correct item could still match.
      const itemGroup = getItemGarmentGroup(item);
      if (itemGroup) {
        if (itemGroup === textGroup) {
          return { score: W.CATEGORY_INFERRED, reasons: [`cat:text_veto_inferred(${textGroup})`] };
        }
        if (isRelatedGroup(itemGroup, textGroup)) {
          return { score: W.CATEGORY_RELATED, reasons: [`cat:text_veto_related(${textGroup}↔${itemGroup})`] };
        }
        return { score: 0, reasons: [`cat:text_veto_mismatch(meta=${cat},text=${textGroup}≠${itemGroup})`] };
      }
    }

    const compatible = OUTFIT_TO_CLOSET_CATEGORY_MAP[cat];
    if (compatible?.includes(item.category)) {
      return { score: W.CATEGORY_STRUCTURED, reasons: [`cat:exact_structured(${cat}→${item.category})`] };
    }
    // Try related-group check as a fallback
    const itemGroup = getItemGarmentGroup(item);
    const pieceGroup = OUTFIT_CATEGORY_TO_GROUP[cat];
    if (itemGroup && pieceGroup) {
      if (itemGroup === pieceGroup) {
        // Same group but not in OUTFIT_TO_CLOSET_CATEGORY_MAP — treat as inferred exact
        return { score: W.CATEGORY_INFERRED, reasons: [`cat:group_match(${pieceGroup})`] };
      }
      if (isRelatedGroup(itemGroup, pieceGroup)) {
        return { score: W.CATEGORY_RELATED, reasons: [`cat:related(${pieceGroup}↔${itemGroup})`] };
      }
    }
    // Confirmed mismatch — hard fail
    return { score: 0, reasons: [`cat:mismatch_structured(${cat}≠${item.category})`] };
  }

  // ── Text inference path ────────────────────────────────────────────────────
  const suggGroup = extractGarmentGroup(piece.display_name.replace(/\(.*?\)/g, '').trim());
  const itemGroup = getItemGarmentGroup(item);

  if (suggGroup && itemGroup) {
    if (suggGroup === itemGroup) {
      // Formality guard: dress shirt suggestion ↔ tee item (or vice versa)
      if (suggGroup === 'shirt' || suggGroup === 'tee') {
        const sd = isDressShirt(piece.display_name);
        const id = isDressShirt(item.title);
        const st = isTee(piece.display_name);
        const it = isTee(item.title);
        if ((sd && it) || (st && id)) {
          return { score: 0, reasons: ['cat:formality_guard(shirt/tee)'] };
        }
      }
      return { score: W.CATEGORY_INFERRED, reasons: [`cat:exact_inferred(${suggGroup})`] };
    }
    if (isRelatedGroup(suggGroup, itemGroup)) {
      return { score: W.CATEGORY_RELATED, reasons: [`cat:related_inferred(${suggGroup}↔${itemGroup})`] };
    }
    // Hard mismatch
    return { score: 0, reasons: [`cat:mismatch_inferred(${suggGroup}≠${itemGroup})`] };
  }

  // One or both sides have no detectable group
  if (suggGroup !== itemGroup) {
    return { score: W.CATEGORY_UNKNOWN, reasons: ['cat:unknown_one_side'] };
  }
  return { score: 0, reasons: ['cat:both_unknown'] };
}

function scoreSubcategory(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  if (!item.subcategory) return { score: 0, reasons: [] };
  const sim = jaccardSimilarity(item.subcategory, piece.display_name);
  if (sim >= 0.50) return { score: W.SUBCATEGORY_HIGH, reasons: [`sub:high(${sim.toFixed(2)})`] };
  if (sim >= 0.28) return { score: W.SUBCATEGORY_MED, reasons: [`sub:med(${sim.toFixed(2)})`] };
  return { score: 0, reasons: [] };
}

function scoreColor(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  // Piece color: use metadata.color if available, else infer from display_name
  const pieceColorText = piece.metadata?.color ?? piece.display_name;
  const pieceColorFamilies = extractColorFamilies(pieceColorText);
  if (!pieceColorFamilies.size) return { score: 0, reasons: ['color:no_piece_color'] };

  // Item color: structured colorFamily beats text inference
  if (item.colorFamily) {
    if (pieceColorFamilies.has(item.colorFamily)) {
      return { score: W.COLOR_STRUCTURED, reasons: [`color:structured_match(${item.colorFamily})`] };
    }
    // Confirmed color mismatch — apply penalty to prevent wrong-color category matches
    return { score: -15, reasons: [`color:structured_mismatch(${item.colorFamily})`] };
  }

  // Text inference fallback
  const itemColorText = (item.primaryColor ?? '') + ' ' + item.title;
  const itemColorFamilies = extractColorFamilies(itemColorText);
  if (!itemColorFamilies.size) return { score: 0, reasons: ['color:no_item_color'] };

  const hasMatch = [...pieceColorFamilies].some((f) => itemColorFamilies.has(f));
  if (hasMatch) return { score: W.COLOR_TEXT, reasons: ['color:text_match'] };
  return { score: 0, reasons: ['color:text_mismatch'] };
}

function scoreMaterial(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  // Item material: structured first
  const itemMaterialText = item.material ?? '';
  const pieceText = (piece.metadata as { material?: string } | null)?.material ?? piece.display_name;

  const itemGroup = getMaterialGroup(itemMaterialText) ?? getMaterialGroup(item.title);
  const pieceGroup = getMaterialGroup(pieceText);

  if (itemGroup && pieceGroup) {
    if (itemGroup === pieceGroup) {
      return { score: W.MATERIAL_EXACT, reasons: [`mat:group_match(${itemGroup})`] };
    }
    return { score: 0, reasons: ['mat:group_mismatch'] };
  }

  // No material group detected on either side — try Jaccard on raw text
  if (itemMaterialText && pieceText) {
    const sim = jaccardSimilarity(itemMaterialText, pieceText);
    if (sim >= 0.40) return { score: W.MATERIAL_FUZZY, reasons: [`mat:fuzzy(${sim.toFixed(2)})`] };
  }

  return { score: 0, reasons: [] };
}

function scoreFormality(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  const pieceFormality = piece.metadata?.formality;
  const itemFormality = item.formality;
  if (!pieceFormality || !itemFormality) return { score: 0, reasons: [] };

  const pRank = FORMALITY_RANK[pieceFormality] ?? -1;
  const iRank = FORMALITY_RANK[itemFormality] ?? -1;
  if (pRank === -1 || iRank === -1) return { score: 0, reasons: [] };

  const diff = Math.abs(pRank - iRank);
  if (diff === 0) return { score: W.FORMALITY_EXACT, reasons: [`form:exact(${pieceFormality})`] };
  if (diff === 1) return { score: W.FORMALITY_ADJACENT, reasons: [`form:adjacent(diff=${diff})`] };
  return { score: W.FORMALITY_FAR, reasons: [`form:far_penalty(diff=${diff})`] };
}

function scoreSilhouette(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  if (!item.silhouette) return { score: 0, reasons: [] };
  const hints = SILHOUETTE_HINTS[item.silhouette];
  if (!hints) return { score: 0, reasons: [] };
  const norm = piece.display_name.toLowerCase();
  if (hints.some((h) => norm.includes(h))) {
    return { score: W.SILHOUETTE_MATCH, reasons: [`sil:match(${item.silhouette})`] };
  }
  return { score: 0, reasons: [] };
}

function scoreFuzzyTitle(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  const sim = jaccardSimilarity(piece.display_name, item.title);
  if (sim >= 0.50) return { score: W.TITLE_HIGH, reasons: [`title:high(${sim.toFixed(2)})`] };
  if (sim >= 0.30) return { score: W.TITLE_MED, reasons: [`title:med(${sim.toFixed(2)})`] };
  return { score: 0, reasons: [] };
}

function scoreFitPenalty(item: ClosetItem): { score: number; reasons: string[] } {
  const poor = new Set(['too-tight', 'fits-large', 'needs-alteration']);
  if (item.fitStatus && poor.has(item.fitStatus)) {
    return { score: W.FITSTAT_POOR, reasons: [`fit:penalty(${item.fitStatus})`] };
  }
  if (item.fitStatus === 'tailored') {
    return { score: W.FITSTAT_TAILORED, reasons: ['fit:tailored_bonus'] };
  }
  return { score: 0, reasons: [] };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scores a single OutfitPiece against a single ClosetItem.
 * Returns a MatchScore with per-dimension breakdown for explainability.
 */
export function scoreClosetMatch(piece: OutfitPiece, item: ClosetItem): MatchScore {
  const reasons: string[] = [];

  const cat = scoreCategory(piece, item);
  reasons.push(...cat.reasons);

  // Hard category mismatch — short-circuit, no point scoring other dimensions
  if (cat.score === 0) {
    return {
      total: 0,
      passesThreshold: false,
      confidencePercent: 0,
      dimensions: { category: 0, subcategory: 0, color: 0, material: 0, formality: 0, silhouette: 0, fuzzyTitle: 0, fitPenalty: 0 },
      reasons,
    };
  }

  const sub  = scoreSubcategory(piece, item);
  const col  = scoreColor(piece, item);
  const mat  = scoreMaterial(piece, item);
  const form = scoreFormality(piece, item);
  const sil  = scoreSilhouette(piece, item);
  const tit  = scoreFuzzyTitle(piece, item);
  const fit  = scoreFitPenalty(item);

  reasons.push(...sub.reasons, ...col.reasons, ...mat.reasons, ...form.reasons, ...sil.reasons, ...tit.reasons, ...fit.reasons);

  const dimensions: MatchDimensions = {
    category:   cat.score,
    subcategory: sub.score,
    color:      col.score,
    material:   mat.score,
    formality:  form.score,
    silhouette: sil.score,
    fuzzyTitle: tit.score,
    fitPenalty: fit.score,
  };

  const total = Object.values(dimensions).reduce((sum, v) => sum + v, 0);
  const confidencePercent = Math.round(Math.min(100, Math.max(0, Math.max(0, total) / MATCH_SCORE_MAX * 100)));

  return { total, passesThreshold: total >= THRESHOLD, confidencePercent, dimensions, reasons };
}

/**
 * Finds the best-matching ClosetItem for an outfit piece recommendation.
 *
 * Accepts OutfitPiece (structured) or string (legacy fallback).
 * Returns null if no item meets the confidence threshold.
 */
export function findBestClosetMatch(
  pieceOrString: OutfitPiece | string,
  items: ClosetItem[],
  excludeIds?: ReadonlySet<string>,
  /** 0–100; maps to min-confidence threshold: 0=50%, 100=80% (linear). Default: 50 raw. */
  sensitivity?: number,
): ClosetItem | null {
  const piece = typeof pieceOrString === 'string' ? normalizePiece(pieceOrString) : pieceOrString;
  const candidates = excludeIds?.size ? items.filter((i) => !excludeIds.has(i.id)) : items;
  if (!candidates.length || !piece.display_name.trim()) return null;

  // sensitivity=0 → 50% min, sensitivity=100 → 80% min (linear)
  const threshold =
    sensitivity === undefined
      ? THRESHOLD
      : Math.round((0.50 + (sensitivity / 100) * 0.30) * MATCH_SCORE_MAX);

  let bestItem: ClosetItem | null = null;
  let bestScore = -Infinity;

  for (const item of candidates) {
    const result = scoreClosetMatch(piece, item);
    if (result.total >= threshold && result.total > bestScore) {
      bestScore = result.total;
      bestItem = item;
    }
  }

  return bestItem;
}

/**
 * Returns the match confidence (0–100) between an outfit piece and a closet item.
 * Convenience wrapper around scoreClosetMatch for callers that only need the percentage.
 */
export function getMatchConfidencePercent(piece: OutfitPiece | string, item: ClosetItem): number {
  const normalized = typeof piece === 'string' ? normalizePiece(piece) : piece;
  return scoreClosetMatch(normalized, item).confidencePercent;
}

/**
 * Validates that a closet item is categorically compatible with a suggestion.
 * Used to sanity-check entries that may have been stored from older matching runs.
 */
export function isClosetMatchValid(
  suggestionOrPiece: string | OutfitPiece,
  item: ClosetItem,
): boolean {
  const piece =
    typeof suggestionOrPiece === 'string' ? normalizePiece(suggestionOrPiece) : suggestionOrPiece;

  // Structured path: check OUTFIT_TO_CLOSET_CATEGORY_MAP
  if (piece.metadata?.category) {
    const compatible = OUTFIT_TO_CLOSET_CATEGORY_MAP[piece.metadata.category];
    if (compatible) return compatible.includes(item.category);
    // Unknown category — allow (can't disprove)
    return true;
  }

  // Text inference path
  const suggGroup = extractGarmentGroup(piece.display_name.replace(/\(.*?\)/g, '').trim());
  const itemGroup = getItemGarmentGroup(item);
  if (!suggGroup || !itemGroup) return true;
  if (suggGroup === itemGroup) return true;
  if (isRelatedGroup(suggGroup, itemGroup)) return true;
  return false;
}
