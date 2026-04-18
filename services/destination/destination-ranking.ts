/**
 * Client-side re-ranking for destination autocomplete results.
 *
 * GeoNames' built-in relevance ordering surfaces obscure exact-name matches
 * (e.g. "Miam-myeon, South Korea") above globally popular travel destinations
 * (e.g. "Miami"). This module re-ranks the raw API results using a weighted
 * score of match quality + population so well-known places always float to the
 * top.
 *
 * Score components (higher = better):
 *   matchScore    — how precisely the query string matches the place's primary name
 *   populationScore — log10(population) * 8, capped to avoid Tokyo drowning everything
 *   typeBonus     — countries and independent states get a modest structural boost
 */

import type { DestinationResult } from './destination-types';

/** Strip diacritics and lowercase for accent-insensitive comparison. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Extract just the primary place name (before the first comma). */
function primaryName(result: DestinationResult): string {
  return normalize(result.city ?? result.label.split(',')[0] ?? result.label);
}

function score(query: string, result: DestinationResult): number {
  const q = normalize(query);
  const name = primaryName(result);
  const fullLabel = normalize(result.label);

  let total = 0;

  // ── Match quality ─────────────────────────────────────────────────────────
  if (name === q) {
    // Exact primary-name match — highest priority
    total += 200;
  } else if (name.startsWith(q)) {
    // Prefix match: reward completeness (longer query relative to name length = better match)
    total += 100 + Math.round((q.length / name.length) * 50);
  } else if (fullLabel.startsWith(q)) {
    total += 55;
  } else if (name.includes(q)) {
    // Query appears inside the name (not at start)
    total += 30;
  } else if (fullLabel.includes(q)) {
    total += 15;
  }

  // ── Popularity (population) ───────────────────────────────────────────────
  // Log scale prevents mega-cities from completely drowning mid-size cities.
  // Cap contribution at ~48 (population ~40M) to keep match quality dominant.
  const pop = result.population ?? 0;
  if (pop > 0) {
    total += Math.min(Math.log10(pop) * 8, 48);
  }

  // ── Type bonus ────────────────────────────────────────────────────────────
  if (result.type === 'country') total += 12;
  else if (result.type === 'city') total += 4;

  return total;
}

/**
 * Re-rank destination results by match quality + popularity.
 * Returns a new sorted array — does not mutate the input.
 */
export function rankDestinationResults(
  query: string,
  results: DestinationResult[],
): DestinationResult[] {
  if (results.length <= 1) return results;
  return [...results].sort((a, b) => score(query, b) - score(query, a));
}
