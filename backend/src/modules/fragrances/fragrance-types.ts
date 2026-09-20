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

export const FRAGRANCE_CONCENTRATION_OPTIONS = [
  'Eau de Cologne', 'Eau de Toilette', 'Eau de Parfum', 'Parfum', 'Extrait', 'Elixir', 'Other', 'Unknown',
] as const;

export type FragranceConcentration = (typeof FRAGRANCE_CONCENTRATION_OPTIONS)[number];
