/**
 * Scoring weights, threshold, and normalisation ceiling for the closet matching engine.
 * Consumed by closet-match.ts — not intended for direct use outside that module.
 */

// ── Scoring weights ────────────────────────────────────────────────────────────

export const W = {
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
export const THRESHOLD = 50;

/**
 * Practical maximum score for a well-matched item.
 * Used to normalise raw scores into a 0–100 % confidence value.
 * (70 cat + 22 color + 16 material + 14 formality + 8 sub/silhouette = 130)
 */
export const MATCH_SCORE_MAX = 130;
