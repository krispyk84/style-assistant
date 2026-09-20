// ── Shared vibe / concentration taxonomy ────────────────────────────────────
// Mirrors backend/src/modules/fragrances/fragrance-types.ts — values must match
// exactly since they're persisted verbatim. Labels are user-facing only.

export const FRAGRANCE_VIBE_OPTIONS = [
  { value: 'FRESH_CLEAN', label: 'Fresh & Clean' },
  { value: 'WARM_COZY', label: 'Warm & Cozy' },
  { value: 'DARK_SEDUCTIVE', label: 'Dark & Seductive' },
  { value: 'WOODY_EARTHY', label: 'Woody & Earthy' },
  { value: 'GOURMAND_SWEET', label: 'Sweet & Gourmand' },
  { value: 'AROMATIC_SPORTY', label: 'Aromatic & Sporty' },
  { value: 'FLORAL_ROMANTIC', label: 'Floral & Romantic' },
  { value: 'SPICY_CONFIDENT', label: 'Spicy & Confident' },
] as const;

export type FragranceVibe = (typeof FRAGRANCE_VIBE_OPTIONS)[number]['value'];

export const FRAGRANCE_CONCENTRATION_OPTIONS = [
  { value: 'Eau de Cologne', label: 'Eau de Cologne' },
  { value: 'Eau de Toilette', label: 'Eau de Toilette' },
  { value: 'Eau de Parfum', label: 'Eau de Parfum' },
  { value: 'Parfum', label: 'Parfum' },
  { value: 'Extrait', label: 'Extrait' },
  { value: 'Elixir', label: 'Elixir' },
  { value: 'Other', label: 'Other' },
] as const;

export type FragranceConcentration = (typeof FRAGRANCE_CONCENTRATION_OPTIONS)[number]['value'];

// ── Manual-entry dimension pickers ──────────────────────────────────────────
// User-facing binary toggles — mapped to the 0-1 scoring dictionaries the
// backend expects (see fragrance-form-mappers.ts). Never shown to the user as
// raw keys/weights.

export const FRAGRANCE_SEASON_OPTIONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
] as const;

export const FRAGRANCE_DAY_NIGHT_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
] as const;

export const FRAGRANCE_FORMALITY_OPTIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'smartCasual', label: 'Smart Casual' },
  { value: 'business', label: 'Business' },
  { value: 'formalEvening', label: 'Special Occasion' },
] as const;

// ── Catalog / ownership shapes ───────────────────────────────────────────────

export type FragranceAccord = { name: string; weight: number };

export type Fragrance = {
  id: string;
  brand: string;
  name: string;
  concentration: string | null;
  topNotes: string[] | null;
  middleNotes: string[] | null;
  baseNotes: string[] | null;
  mainAccords: FragranceAccord[] | null;
  primaryVibe: string | null;
  secondaryVibes: string[] | null;
  seasonality: Record<string, number> | null;
  dayNight: Record<string, number> | null;
  formality: Record<string, number> | null;
  profileSource: 'llm' | 'manual';
  profileConfidence: number | null;
};

export type UserFragrance = {
  id: string;
  fragranceId: string;
  fragrance: Fragrance;
  originalImageUrl: string | null;
  bottleSketchUrl: string | null;
  bottleSketchStatus: 'not_started' | 'pending' | 'ready' | 'failed';
  isSignature: boolean;
  currentVolumeMl: number | null;
  userNotes: string | null;
  profileOverrides: Record<string, unknown> | null;
  createdAt: string;
};

// ── Ingestion (profiling) result — mirrors backend ProfileFragranceResult ───

export type ProfileFragranceResult =
  | { status: 'found'; fragrance: Fragrance }
  | { status: 'created'; fragrance: Fragrance }
  | { status: 'needs_review'; confidence: number; hint: { brand: string | null; name: string | null; concentration: string | null } };

// ── Outfit fragrance recommendation ──────────────────────────────────────────
// Shared across Create Look / Ask a Stylist, Trip results, and Generate 5
// Outfits — mirrors the backend's (currently duplicated) FragranceRecommendationDto.

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
