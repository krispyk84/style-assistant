import type { CreateManualFragrancePayload, ProfileFragrancePayload } from '@/services/fragrances/fragrances-service';
import type { Fragrance, FragranceAccord } from '@/types/fragrance';

// ── Binary dimension <-> 0-1 scoring dict ────────────────────────────────────
// The manual-entry form presents seasonality/day-night/formality as simple
// multi-select toggles (user-facing, no raw weights) — this maps that
// selection to/from the 0-1 dictionaries the deterministic recommender reads.
// Selecting a key stores 1 (a clear "yes"); an unselected key is simply
// omitted rather than written as an explicit 0, so a dimension the user never
// touched stays absent (neutral) rather than reading as an active exclusion.

export function selectedToDimensionDict(selected: string[]): Record<string, number> | undefined {
  if (selected.length === 0) return undefined;
  return Object.fromEntries(selected.map((key) => [key, 1]));
}

/** Inverse — for pre-filling the editable toggles from an AI-profiled fragrance's existing weighted dict. Anything >= 0.5 counts as "on" for editing purposes. */
export function dimensionDictToSelected(dict: Record<string, number> | null | undefined, allKeys: readonly string[]): string[] {
  if (!dict) return [];
  return allKeys.filter((key) => (dict[key] ?? 0) >= 0.5);
}

// ── Accords ───────────────────────────────────────────────────────────────────

/** Equal weighting — the scorer only compares relative accord weights within one fragrance, so uniform weight-1 entries are sufficient for user-entered accords (no UI for fine-grained weighting). */
export function accordNamesToAccords(names: string[]): FragranceAccord[] | undefined {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return undefined;
  return trimmed.map((name) => ({ name, weight: 1 }));
}

export function accordsToNames(accords: FragranceAccord[] | null | undefined): string[] {
  return accords?.map((a) => a.name) ?? [];
}

// ── Form field shape (shared by the identify flow and manual entry) ────────

export type FragranceFormFields = {
  brand: string;
  name: string;
  concentration: string | undefined;
  accordNames: string[];
  primaryVibe: string | undefined;
  secondaryVibes: string[];
  seasons: string[];
  dayNight: string[];
  formalityTags: string[];
  isSignature: boolean;
  currentVolumeMl: string;
  userNotes: string;
  // Read-only, AI-only — never user-edited, only ever populated from a resolved catalog fragrance.
  topNotes: string[] | null;
  middleNotes: string[] | null;
  baseNotes: string[] | null;
};

export const EMPTY_FRAGRANCE_FORM_FIELDS: FragranceFormFields = {
  brand: '',
  name: '',
  concentration: undefined,
  accordNames: [],
  primaryVibe: undefined,
  secondaryVibes: [],
  seasons: [],
  dayNight: [],
  formalityTags: [],
  isSignature: false,
  currentVolumeMl: '',
  userNotes: '',
  topNotes: null,
  middleNotes: null,
  baseNotes: null,
};

const SEASON_KEYS = ['spring', 'summer', 'fall', 'winter'] as const;
const DAY_NIGHT_KEYS = ['day', 'night'] as const;
const FORMALITY_KEYS = ['casual', 'smartCasual', 'business', 'formalEvening'] as const;

/** Populates editable form fields from a resolved catalog Fragrance (AI-recognized or a manual catalog hit) — the user can still review/correct every field before saving. */
export function fieldsFromCatalogFragrance(fragrance: Fragrance): Partial<FragranceFormFields> {
  return {
    brand: fragrance.brand,
    name: fragrance.name,
    concentration: fragrance.concentration ?? undefined,
    accordNames: accordsToNames(fragrance.mainAccords),
    primaryVibe: fragrance.primaryVibe ?? undefined,
    secondaryVibes: fragrance.secondaryVibes ?? [],
    seasons: dimensionDictToSelected(fragrance.seasonality, SEASON_KEYS),
    dayNight: dimensionDictToSelected(fragrance.dayNight, DAY_NIGHT_KEYS),
    formalityTags: dimensionDictToSelected(fragrance.formality, FORMALITY_KEYS),
    topNotes: fragrance.topNotes,
    middleNotes: fragrance.middleNotes,
    baseNotes: fragrance.baseNotes,
  };
}

export function buildProfileFragrancePayload(imageUrl: string): ProfileFragrancePayload {
  return { imageUrl };
}

export function buildManualFragrancePayload(fields: FragranceFormFields): CreateManualFragrancePayload {
  return {
    brand: fields.brand.trim(),
    name: fields.name.trim(),
    concentration: fields.concentration,
    primaryVibe: fields.primaryVibe,
    secondaryVibes: fields.secondaryVibes.length > 0 ? fields.secondaryVibes : undefined,
    seasonality: selectedToDimensionDict(fields.seasons),
    formality: selectedToDimensionDict(fields.formalityTags),
  };
}

/**
 * Field-by-field diff against the resolved catalog fragrance — only fields
 * the user actually changed from the catalog's own values are sent as
 * profileOverrides, matching the backend's applyOverrides shape. Never
 * mutates the shared catalog row; this is stored on the UserFragrance only.
 */
export function buildProfileOverrides(fields: FragranceFormFields, base: Fragrance): Record<string, unknown> | undefined {
  const overrides: Record<string, unknown> = {};

  if ((fields.concentration ?? null) !== base.concentration) overrides.concentration = fields.concentration ?? null;

  const accords = accordNamesToAccords(fields.accordNames);
  if (JSON.stringify(accords ?? []) !== JSON.stringify(base.mainAccords ?? [])) overrides.mainAccords = accords ?? [];

  if ((fields.primaryVibe ?? null) !== base.primaryVibe) overrides.primaryVibe = fields.primaryVibe ?? null;

  if (JSON.stringify([...fields.secondaryVibes].sort()) !== JSON.stringify([...(base.secondaryVibes ?? [])].sort())) {
    overrides.secondaryVibes = fields.secondaryVibes;
  }

  const seasonality = selectedToDimensionDict(fields.seasons) ?? {};
  if (JSON.stringify(seasonality) !== JSON.stringify(base.seasonality ?? {})) overrides.seasonality = seasonality;

  const dayNight = selectedToDimensionDict(fields.dayNight) ?? {};
  if (JSON.stringify(dayNight) !== JSON.stringify(base.dayNight ?? {})) overrides.dayNight = dayNight;

  const formality = selectedToDimensionDict(fields.formalityTags) ?? {};
  if (JSON.stringify(formality) !== JSON.stringify(base.formality ?? {})) overrides.formality = formality;

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/** True when the form's identity fields still match the resolved catalog fragrance — if the user edited brand/name/concentration away from what was recognized, the resolved id is no longer valid and a fresh manual-dedup lookup is needed instead. */
export function identityMatchesResolved(fields: FragranceFormFields, base: Fragrance): boolean {
  return (
    fields.brand.trim().toLowerCase() === base.brand.trim().toLowerCase() &&
    fields.name.trim().toLowerCase() === base.name.trim().toLowerCase() &&
    (fields.concentration ?? '') === (base.concentration ?? '')
  );
}
