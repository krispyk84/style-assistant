/**
 * Closet matching engine — orchestrator.
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
import type { OutfitPiece } from '@/types/look-request';
import { normalizePiece, OUTFIT_TO_CLOSET_CATEGORY_MAP } from '@/types/look-request';
import { W, THRESHOLD, MATCH_SCORE_MAX } from './closet-match-weights';
import {
  extractGarmentGroup,
  getItemGarmentGroup,
  isRelatedGroup,
  scoreCategory,
  scoreSubcategory,
  scoreColor,
  scoreMaterial,
  scoreFormality,
  scoreSilhouette,
  scoreFuzzyTitle,
  scoreFitPenalty,
} from './closet-match-scoring';

export { MATCH_SCORE_MAX };
export type { MatchDimensions, MatchScore } from './closet-match-scoring';

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scores a single OutfitPiece against a single ClosetItem.
 * Returns a MatchScore with per-dimension breakdown for explainability.
 */
export function scoreClosetMatch(piece: OutfitPiece, item: ClosetItem) {
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

  const dimensions = {
    category:    cat.score,
    subcategory: sub.score,
    color:       col.score,
    material:    mat.score,
    formality:   form.score,
    silhouette:  sil.score,
    fuzzyTitle:  tit.score,
    fitPenalty:  fit.score,
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
