/**
 * Fuzzy text utilities for the closet matching engine.
 *
 * No imports from other closet-match modules — this is the bottom of the
 * dependency chain. Consumed by closet-match-scoring.ts.
 */

// ── Text normalisation ─────────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Jaccard similarity ─────────────────────────────────────────────────────────

/**
 * Jaccard token similarity — equivalent to RapidFuzz `token_set_ratio` for short garment texts.
 * Returns 0–1; higher = more similar.
 * Used as a supporting signal only: never overrides category logic.
 */
export function jaccardSimilarity(a: string, b: string): number {
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
