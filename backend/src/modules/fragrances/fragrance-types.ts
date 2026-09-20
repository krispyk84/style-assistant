// Shared, dependency-free fragrance types — imported by BOTH the AI-ingestion
// layer (fragrance-profile.prompts.ts, fragrance-profile.service.ts) and the
// deterministic runtime recommender (fragrance-recommendation.service.ts).
// This file itself must never import from ai/ or any *.service.ts that
// touches openai-client.ts — that's what keeps the recommender's "zero LLM
// dependency" invariant (spec section 41) simple to verify statically: the
// recommender only ever imports from here and from Node builtins.

export const FRAGRANCE_VIBE_OPTIONS = [
  'FRESH_CLEAN', 'WARM_COZY', 'DARK_SEDUCTIVE', 'WOODY_EARTHY', 'GOURMAND_SWEET',
  'AROMATIC_SPORTY', 'FLORAL_ROMANTIC', 'SPICY_CONFIDENT',
] as const;

export type FragranceVibe = (typeof FRAGRANCE_VIBE_OPTIONS)[number];

// Shared JSON-schema description string for the `primaryVibe` field every
// outfit-generation response schema adds (outfits, trips, closet) — each
// outfit-generation LLM call classifies the outfit it just assembled
// against this same fixed taxonomy, which the deterministic fragrance
// recommender (fragrance-recommendation.service.ts) then matches against
// each fragrance's own primaryVibe/secondaryVibes. One shared string keeps
// the instruction identical across all three call sites.
export const FRAGRANCE_VIBE_SCHEMA_DESCRIPTION =
  "This outfit's own aesthetic, classified against a fixed vibe taxonomy — used downstream to match it with a fragrance that shares the same character (not just its weather/formality fit). Judge from the actual pieces and colors chosen, not the occasion alone.";

export const FRAGRANCE_CONCENTRATION_OPTIONS = [
  'Eau de Cologne', 'Eau de Toilette', 'Eau de Parfum', 'Parfum', 'Extrait', 'Elixir', 'Other', 'Unknown',
] as const;

export type FragranceConcentration = (typeof FRAGRANCE_CONCENTRATION_OPTIONS)[number];
