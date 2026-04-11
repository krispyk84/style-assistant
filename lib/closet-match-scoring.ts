/**
 * Per-dimension scoring functions for the closet matching engine.
 *
 * Dependency order: fuzzy → scoring → orchestrator (closet-match.ts).
 * Three functions call into the fuzzy layer (flagged below).
 */

import type { ClosetItem } from '@/types/closet';
import type { OutfitPiece } from '@/types/look-request';
import { OUTFIT_TO_CLOSET_CATEGORY_MAP } from '@/types/look-request';
import { W } from './closet-match-weights';
import {
  GARMENT_GROUPS,
  CATEGORY_TO_GROUP,
  OUTFIT_CATEGORY_TO_GROUP,
  RELATED_GROUP_SETS,
  COLOR_FAMILIES,
  MATERIAL_GROUPS,
  FORMALITY_RANK,
  SILHOUETTE_HINTS,
} from './closet-match-taxonomy';
import { normalizeText, jaccardSimilarity } from './closet-match-fuzzy';

// ── Taxonomy helpers ───────────────────────────────────────────────────────────
// extractGarmentGroup, getItemGarmentGroup, and isRelatedGroup are also used by
// isClosetMatchValid in the orchestrator and are therefore exported.

export function extractGarmentGroup(text: string): string | null {
  const norm = normalizeText(text);
  for (const [group, keywords] of Object.entries(GARMENT_GROUPS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) return group;
    }
  }
  return null;
}

export function getItemGarmentGroup(item: ClosetItem): string | null {
  return CATEGORY_TO_GROUP[item.category] ?? extractGarmentGroup(item.title);
}

export function isRelatedGroup(a: string, b: string): boolean {
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

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Scoring functions ──────────────────────────────────────────────────────────

export function scoreCategory(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
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

/** ⚠ Calls fuzzy layer: jaccardSimilarity */
export function scoreSubcategory(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  if (!item.subcategory) return { score: 0, reasons: [] };
  const sim = jaccardSimilarity(item.subcategory, piece.display_name);
  if (sim >= 0.50) return { score: W.SUBCATEGORY_HIGH, reasons: [`sub:high(${sim.toFixed(2)})`] };
  if (sim >= 0.28) return { score: W.SUBCATEGORY_MED, reasons: [`sub:med(${sim.toFixed(2)})`] };
  return { score: 0, reasons: [] };
}

export function scoreColor(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
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

/** ⚠ Calls fuzzy layer: jaccardSimilarity (fallback branch when no material group detected) */
export function scoreMaterial(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
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

export function scoreFormality(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
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

export function scoreSilhouette(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  if (!item.silhouette) return { score: 0, reasons: [] };
  const hints = SILHOUETTE_HINTS[item.silhouette];
  if (!hints) return { score: 0, reasons: [] };
  const norm = piece.display_name.toLowerCase();
  if (hints.some((h) => norm.includes(h))) {
    return { score: W.SILHOUETTE_MATCH, reasons: [`sil:match(${item.silhouette})`] };
  }
  return { score: 0, reasons: [] };
}

/** ⚠ Calls fuzzy layer: jaccardSimilarity — body is entirely fuzzy threshold checks */
export function scoreFuzzyTitle(piece: OutfitPiece, item: ClosetItem): { score: number; reasons: string[] } {
  const sim = jaccardSimilarity(piece.display_name, item.title);
  if (sim >= 0.50) return { score: W.TITLE_HIGH, reasons: [`title:high(${sim.toFixed(2)})`] };
  if (sim >= 0.30) return { score: W.TITLE_MED, reasons: [`title:med(${sim.toFixed(2)})`] };
  return { score: 0, reasons: [] };
}

export function scoreFitPenalty(item: ClosetItem): { score: number; reasons: string[] } {
  const poor = new Set(['too-tight', 'fits-large', 'needs-alteration']);
  if (item.fitStatus && poor.has(item.fitStatus)) {
    return { score: W.FITSTAT_POOR, reasons: [`fit:penalty(${item.fitStatus})`] };
  }
  if (item.fitStatus === 'tailored') {
    return { score: W.FITSTAT_TAILORED, reasons: ['fit:tailored_bonus'] };
  }
  return { score: 0, reasons: [] };
}
