// Glue between the pure recommender (fragrance-recommendation.service.ts,
// which MUST stay free of DB/AI dependencies) and the database — this file is
// allowed to touch Prisma; the pure module it calls into is not. Called from
// each of the three outfit-generation services after their own response is
// fully assembled.

import { fragrancesRepository } from './fragrances.repository.js';
import {
  recommendFragrance,
  type OwnedFragrance,
  type RecommendationContext,
  type ScorableFragrance,
} from './fragrance-recommendation.service.js';

export type FragranceRecommendationDto = {
  userFragranceId: string;
  fragranceId: string;
  brand: string;
  name: string;
  concentration: string | null;
  bottleSketchUrl: string | null;
  keyAccords: string[];
  primaryVibe: string | null;
  reason: string;
};

/** Effective profile = user override over catalog, field by field (spec section 18) — never mutates the shared catalog row itself. */
function applyOverrides(fragrance: ScorableFragrance, overrides: unknown): ScorableFragrance {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return fragrance;
  const o = overrides as Partial<ScorableFragrance>;
  return {
    ...fragrance,
    concentration: o.concentration ?? fragrance.concentration,
    topNotes: o.topNotes ?? fragrance.topNotes,
    middleNotes: o.middleNotes ?? fragrance.middleNotes,
    baseNotes: o.baseNotes ?? fragrance.baseNotes,
    mainAccords: o.mainAccords ?? fragrance.mainAccords,
    primaryVibe: o.primaryVibe ?? fragrance.primaryVibe,
    secondaryVibes: o.secondaryVibes ?? fragrance.secondaryVibes,
    seasonality: o.seasonality ?? fragrance.seasonality,
    dayNight: o.dayNight ?? fragrance.dayNight,
    formality: o.formality ?? fragrance.formality,
  };
}

type LoadedFragrances = {
  owned: OwnedFragrance[];
  bottleSketchByUserFragranceId: Map<string, string | null>;
};

/**
 * One efficient query for the user's owned fragrances (spec section 36) —
 * call ONCE per generation request, even when scoring multiple outfits/tiers
 * from it (see scoreLoadedFragrances). Empty-inventory callers get an empty
 * `owned` array back rather than a special case to handle.
 */
export async function loadOwnedFragrances(supabaseUserId: string): Promise<LoadedFragrances> {
  const rows = await fragrancesRepository.listUserFragrances(supabaseUserId);

  const owned: OwnedFragrance[] = rows.map((row) => {
    const base: ScorableFragrance = {
      id: row.fragrance.id,
      brand: row.fragrance.brand,
      name: row.fragrance.name,
      concentration: row.fragrance.concentration,
      topNotes: row.fragrance.topNotes as string[] | null,
      middleNotes: row.fragrance.middleNotes as string[] | null,
      baseNotes: row.fragrance.baseNotes as string[] | null,
      mainAccords: row.fragrance.mainAccords as { name: string; weight: number }[] | null,
      primaryVibe: row.fragrance.primaryVibe,
      secondaryVibes: row.fragrance.secondaryVibes as string[] | null,
      seasonality: row.fragrance.seasonality as Record<string, number> | null,
      dayNight: row.fragrance.dayNight as Record<string, number> | null,
      formality: row.fragrance.formality as Record<string, number> | null,
    };
    return {
      userFragranceId: row.id,
      isSignature: row.isSignature,
      currentVolumeMl: row.currentVolumeMl,
      fragrance: applyOverrides(base, row.profileOverrides),
    };
  });

  return {
    owned,
    bottleSketchByUserFragranceId: new Map(rows.map((row) => [row.id, row.bottleSketchUrl])),
  };
}

/** Pure, synchronous scoring against an already-loaded inventory — safe to call once per tier/day/look without re-querying. */
export function scoreLoadedFragrances(loaded: LoadedFragrances, context: RecommendationContext): FragranceRecommendationDto | null {
  if (loaded.owned.length === 0) return null;

  const recommendation = recommendFragrance({ ownedFragrances: loaded.owned, context });
  if (!recommendation) return null;

  return {
    ...recommendation,
    bottleSketchUrl: loaded.bottleSketchByUserFragranceId.get(recommendation.userFragranceId) ?? null,
  };
}

/** Convenience wrapper for the common single-context case (trips, closet-outfits, single-tier regenerate). */
export async function buildFragranceRecommendation(
  supabaseUserId: string,
  context: RecommendationContext,
): Promise<FragranceRecommendationDto | null> {
  const loaded = await loadOwnedFragrances(supabaseUserId);
  return scoreLoadedFragrances(loaded, context);
}
