import { openAiClient } from '../../ai/openai-client.js';
import { resolveImageUrlForAI } from '../../ai/image-input.js';
import { env } from '../../config/env.js';
import { buildFragranceProfilePrompt, fragranceProfileResponseSchema } from '../../ai/prompts/fragrance-profile.prompts.js';
import { buildCanonicalKey, normalizeBrand, normalizeName } from './fragrance-normalize.js';
import { fragrancesRepository } from './fragrances.repository.js';

// ── Catalog-first fragrance ingestion ────────────────────────────────────────
//
// This is the ONLY place the fragrance-profiling LLM call happens — always at
// ingestion (adding a new fragrance), never at outfit-recommendation runtime
// (fragrance-recommendation.service.ts only ever reads already-persisted
// Fragrance rows, with zero AI dependency — see that module's own header
// comment for the explicit invariant).
//
// Flow: catalog lookup by canonical key FIRST (zero LLM calls on a hit) →
// only on a miss, call the LLM once → re-check the catalog by the LLM's OWN
// (possibly corrected) canonical key, since it may fix a typo/variant a
// second user's identical-but-misspelled input would otherwise duplicate →
// only then create a new catalog row.

const RECOGNITION_CONFIDENCE_THRESHOLD = 0.6;

export type FragranceRow = NonNullable<Awaited<ReturnType<typeof fragrancesRepository.findByCanonicalKey>>>;

export type ProfileFragranceResult =
  | { status: 'found'; fragrance: FragranceRow }
  | { status: 'created'; fragrance: FragranceRow }
  | { status: 'needs_review'; confidence: number; hint: { brand: string | null; name: string | null; concentration: string | null } };

export async function resolveFragranceProfile(input: {
  brand?: string;
  name?: string;
  concentration?: string;
  imageUrl?: string;
  supabaseUserId: string;
}): Promise<ProfileFragranceResult> {
  if (input.brand?.trim() && input.name?.trim()) {
    const canonicalKey = buildCanonicalKey(input.brand, input.name, input.concentration);
    const existing = await fragrancesRepository.findByCanonicalKey(canonicalKey);
    if (existing) return { status: 'found', fragrance: existing };
  }

  const imageBlock = input.imageUrl ? await resolveImageUrlForAI(input.imageUrl) : null;
  const { instructions, userContent, jsonSchema } = buildFragranceProfilePrompt({
    brand: input.brand ?? null,
    name: input.name ?? null,
    concentration: input.concentration ?? null,
    imageBlock,
  });

  const result = await openAiClient.createStructuredResponse({
    schema: fragranceProfileResponseSchema,
    jsonSchema,
    instructions,
    userContent,
    supabaseUserId: input.supabaseUserId,
    feature: 'fragrance-profile',
  });

  if (!result.recognized || result.confidence < RECOGNITION_CONFIDENCE_THRESHOLD || !result.canonicalBrand || !result.canonicalName) {
    return {
      status: 'needs_review',
      confidence: result.confidence,
      hint: {
        brand: result.canonicalBrand ?? input.brand ?? null,
        name: result.canonicalName ?? input.name ?? null,
        concentration: result.concentration ?? input.concentration ?? null,
      },
    };
  }

  const llmCanonicalKey = buildCanonicalKey(result.canonicalBrand, result.canonicalName, result.concentration);
  const existingAfterLlm = await fragrancesRepository.findByCanonicalKey(llmCanonicalKey);
  if (existingAfterLlm) return { status: 'found', fragrance: existingAfterLlm };

  const created = await fragrancesRepository.createFragrance({
    brand: result.canonicalBrand,
    name: result.canonicalName,
    concentration: result.concentration ?? null,
    normalizedBrand: normalizeBrand(result.canonicalBrand),
    normalizedName: normalizeName(result.canonicalName),
    canonicalKey: llmCanonicalKey,
    topNotes: result.topNotes ?? undefined,
    middleNotes: result.middleNotes ?? undefined,
    baseNotes: result.baseNotes ?? undefined,
    mainAccords: result.mainAccords ?? undefined,
    primaryVibe: result.primaryVibe ?? null,
    secondaryVibes: result.secondaryVibes ?? undefined,
    seasonality: result.seasonality ?? undefined,
    dayNight: result.dayNight ?? undefined,
    formality: result.formality ?? undefined,
    profileSource: 'llm',
    profileModel: env.OPENAI_RESPONSES_MODEL,
    profileVersion: '1',
    profileConfidence: result.confidence,
  });

  return { status: 'created', fragrance: created };
}

/**
 * The manual-fallback path (spec section 17): no AI call at all — the user
 * typed brand/name/vibe/seasonality/formality themselves. Still goes through
 * the same catalog-dedup lookup so two users manually entering the same
 * fragrance share one catalog row.
 */
export async function createOrReuseManualFragrance(input: {
  brand: string;
  name: string;
  concentration?: string | null;
  primaryVibe?: string | null;
  secondaryVibes?: string[] | null;
  seasonality?: Record<string, number> | null;
  formality?: Record<string, number> | null;
}): Promise<FragranceRow> {
  const canonicalKey = buildCanonicalKey(input.brand, input.name, input.concentration);
  const existing = await fragrancesRepository.findByCanonicalKey(canonicalKey);
  if (existing) return existing;

  return fragrancesRepository.createFragrance({
    brand: input.brand,
    name: input.name,
    concentration: input.concentration ?? null,
    normalizedBrand: normalizeBrand(input.brand),
    normalizedName: normalizeName(input.name),
    canonicalKey,
    primaryVibe: input.primaryVibe ?? null,
    secondaryVibes: input.secondaryVibes ?? undefined,
    seasonality: input.seasonality ?? undefined,
    formality: input.formality ?? undefined,
    profileSource: 'manual',
    profileConfidence: null,
  });
}
