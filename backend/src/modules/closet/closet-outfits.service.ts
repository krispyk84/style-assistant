import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { runWithConcurrencyLimit } from '../../lib/concurrency-limit.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import {
  buildClosetOutfitNarrationSystemPrompt,
  buildClosetOutfitNarrationUserPrompt,
  type ClosetOutfitSeasonalTrendsContext,
} from '../../ai/prompts/closet-outfits.prompts.js';
import { buildClosetOutfitSketchPrompt } from '../../ai/prompts/closet-outfit-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { profileRepository } from '../profile/profile.repository.js';
import { seasonalTrendsService } from '../seasonal-trends/seasonal-trends.service.js';
import { trendFeedbackService } from '../seasonal-trends/trend-feedback.service.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import { buildClosetIndex } from './closet-index.js';
import { closetRepository } from './closet.repository.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { closetOutfitNarrationResponseSchema, CLOSET_OUTFIT_NARRATION_JSON_SCHEMA } from './closet.schemas.js';
import { buildDeterministicOutfit, pickVariantReplacements, type DeterministicOutfitResult } from './closet-outfit-builder.js';
import { CATEGORY_TO_GROUP, FORMALITY_RANK, GROUP_TO_SLOTS, TIER_FORMALITY_TARGET, type OutfitSlot } from './closet-taxonomy.js';
import type {
  GenerateClosetOutfitsPayload,
  GenerateClosetOutfitVariationsPayload,
  UpdateClosetOutfitAccessoriesPayload,
} from './closet.validation.js';

function fashionGenderForProfile(gender: string | null | undefined): FashionGender {
  return gender === 'woman' ? 'womenswear' : 'menswear';
}

async function loadSeasonalTrends(supabaseUserId: string, hemisphere?: Hemisphere) {
  if (!hemisphere) return null;
  const profile = await profileRepository.findByUserId(supabaseUserId);
  const fashionGender = fashionGenderForProfile(profile?.gender);
  const [result, feedbackMap] = await Promise.all([
    seasonalTrendsService.getCurrentTrendProfile(fashionGender, hemisphere),
    trendFeedbackService.getFeedbackMap(supabaseUserId, fashionGender),
  ]);
  if (!result) return null;
  return { ...result, feedbackMap };
}

// Mirrors lib/closet-readiness.ts's MIN_TOTAL_ITEMS — that client-side gate
// is what actually stops a request from being made with an unusable closet;
// this is a server-side backstop in case a client ever skips that check.
const MIN_WARDROBE_SIZE = 10;
const TARGET_OUTFIT_COUNT = 5;
// Bounds actual concurrent generations (not just start times) — each
// gpt-image-1-mini call holds a full image buffer in memory for its
// duration; too much real concurrency across requests is what tripped the
// server's memory limit on the trend-sketch side, so this mirrors that fix.
const SKETCH_GENERATION_CONCURRENCY = 3;
// Two batches' worth of outfits (a base 5 + a variations 5) — wide enough to
// meaningfully steer selection away from repeats, narrow enough that older
// generations stop suppressing an item forever.
const RECENT_OUTFITS_FOR_VARIETY = 10;
// A batch-built outfit can duplicate an earlier one in the same batch by
// chance (small closets, weighted randomization) — retry a few times before
// accepting the duplicate rather than looping indefinitely.
const MAX_DUPLICATE_RETRIES = 3;

const FORMALITY_LABEL: Record<string, string> = {
  business: 'Business',
  'smart-casual': 'Smart Casual',
  casual: 'Casual',
};

type MappedClosetItem = ReturnType<typeof mapClosetItem>;
type BuilderItem = Awaited<ReturnType<typeof closetRepository.getItems>>[number];

type ResolvedOutfit = {
  id: string;
  title: string;
  whyItWorks: string;
  items: MappedClosetItem[];
  feedbackId: string;
  feedback: 'love' | 'hate' | null;
  sketchJobId: string;
  sketchStatus: 'pending' | 'ready' | 'failed';
  sketchImageUrl: string | null;
};

async function loadIndex(supabaseUserId: string) {
  const { index, itemsById } = await buildClosetIndex(supabaseUserId);
  if (index.length < MIN_WARDROBE_SIZE) {
    throw new HttpError(
      422,
      'INSUFFICIENT_ITEMS',
      `Add at least ${MIN_WARDROBE_SIZE} closet items before generating full outfits.`,
    );
  }
  return { itemsById };
}

// ── Weather gating — mirrors the temperature bands in the narration prompt's
// buildTemperatureRule, translated into whether a layering/outerwear slot
// should be attempted at all (the caller's job per the shared builder's
// contract, not the builder's own concern). ──────────────────────────────────
function weatherGates(temperatureC: number | null): { includeLayering: boolean; includeOuterwear: boolean } {
  if (temperatureC == null) return { includeLayering: true, includeOuterwear: true };
  if (temperatureC >= 24) return { includeLayering: false, includeOuterwear: false };
  if (temperatureC >= 18) return { includeLayering: false, includeOuterwear: true };
  return { includeLayering: true, includeOuterwear: true };
}

// Seeds group-diversity tracking from cross-session history (not just this
// batch) — an item used in outfits generated recently deprioritizes its whole
// garment GROUP for the slot(s) it can fill, so today's fresh batch doesn't
// immediately reconverge on the same shoe/top type as last time.
function seedRecentGroupsBySlot(
  recentlyUsedItemIds: string[],
  itemsById: Map<string, BuilderItem>,
): Partial<Record<OutfitSlot, Set<string>>> {
  const seed: Partial<Record<OutfitSlot, Set<string>>> = {};
  for (const id of recentlyUsedItemIds) {
    const category = itemsById.get(id)?.category;
    const group = category ? CATEGORY_TO_GROUP[category] : undefined;
    if (!group) continue;
    for (const slot of GROUP_TO_SLOTS[group] ?? []) {
      (seed[slot] ??= new Set()).add(group);
    }
  }
  return seed;
}

function outfitKey(result: DeterministicOutfitResult<BuilderItem>): string {
  return [...result.itemIds].sort().join('|');
}

// Builds `count` deterministic outfits, accumulating per-slot group usage
// across the batch (on top of the cross-session seed) so the N outfits in one
// response are mutually type-diverse, not just individually formality-correct.
function buildOutfitBatch(params: {
  closetItems: BuilderItem[];
  targetFormalityRank: number;
  includeLayering: boolean;
  includeOuterwear: boolean;
  count: number;
  seedGroupsBySlot: Partial<Record<OutfitSlot, Set<string>>>;
}): DeterministicOutfitResult<BuilderItem>[] {
  const recentGroupsBySlot: Partial<Record<OutfitSlot, Set<string>>> = {};
  for (const slot of Object.keys(params.seedGroupsBySlot) as OutfitSlot[]) {
    recentGroupsBySlot[slot] = new Set(params.seedGroupsBySlot[slot]);
  }

  const results: DeterministicOutfitResult<BuilderItem>[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < params.count; i++) {
    let result: DeterministicOutfitResult<BuilderItem> | null = null;
    for (let attempt = 0; attempt < MAX_DUPLICATE_RETRIES; attempt++) {
      const candidate = buildDeterministicOutfit({
        closetItems: params.closetItems,
        targetFormalityRank: params.targetFormalityRank,
        includeLayering: params.includeLayering,
        includeOuterwear: params.includeOuterwear,
        recentGroupsBySlot,
      });
      const key = outfitKey(candidate);
      if (!seenKeys.has(key) || attempt === MAX_DUPLICATE_RETRIES - 1) {
        result = candidate;
        seenKeys.add(key);
        break;
      }
    }
    if (!result) continue;

    results.push(result);
    for (const [slot, item] of Object.entries(result.bySlot) as [OutfitSlot, BuilderItem][]) {
      const group = CATEGORY_TO_GROUP[item.category];
      if (!group) continue;
      (recentGroupsBySlot[slot] ??= new Set()).add(group);
    }
  }

  return results;
}

// An outfit missing footwear, bottoms, or a top is a failed build (the
// closet genuinely lacks that category) — not a partial success worth
// showing. Every other slot is optional by nature (weather-gated, or
// opt-in accessories).
function isValidOutfit(result: DeterministicOutfitResult<BuilderItem>): boolean {
  return Boolean(result.bySlot.footwear && result.bySlot.bottoms && result.bySlot.tops);
}

async function narrateOutfits(params: {
  outfits: { index: number; items: MappedClosetItem[] }[];
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null;
  supabaseUserId: string;
}): Promise<Map<number, { title: string; whyItWorks: string }>> {
  const userPrompt = buildClosetOutfitNarrationUserPrompt({
    outfits: params.outfits.map((outfit) => ({
      index: outfit.index,
      items: outfit.items.map((item) => ({
        id: item.id,
        name: item.title,
        category: item.category,
        color_family: item.colorFamily ?? null,
        formality: item.formality ?? null,
      })),
    })),
    formality: params.formality,
    weatherSummary: params.weatherSummary,
    weatherStylingHint: params.weatherStylingHint,
    season: params.season,
    temperatureC: params.temperatureC,
    weatherCode: params.weatherCode,
    trendiness: params.trendiness,
    additionalDetails: params.additionalDetails,
    seasonalTrends: params.seasonalTrends,
  });

  try {
    const result = await openAiClient.createStructuredResponse({
      schema: closetOutfitNarrationResponseSchema,
      jsonSchema: CLOSET_OUTFIT_NARRATION_JSON_SCHEMA,
      instructions: buildClosetOutfitNarrationSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'outfit-generation',
    });
    return new Map(result.outfits.map((outfit) => [outfit.index, { title: outfit.title, whyItWorks: outfit.whyItWorks }]));
  } catch (error) {
    // Narration is flavor text on top of already-real, already-valid items —
    // a narration failure shouldn't block showing the outfit itself.
    const { code } = describeError(error);
    logger.warn({ errorCode: code, error }, 'Closet outfit narration failed — falling back to generic titles');
    return new Map();
  }
}

function fallbackTitle(formality: string): string {
  return `${FORMALITY_LABEL[formality] ?? formality} Look`;
}

const FALLBACK_WHY_IT_WORKS = 'A complete outfit built entirely from pieces you already own.';

async function generateOutfitSketch(
  jobId: string,
  outfit: { title: string; items: MappedClosetItem[] },
  subjectBrief: string,
  supabaseUserId: string,
) {
  try {
    const prompt = buildClosetOutfitSketchPrompt({
      outfitTitle: outfit.title,
      items: outfit.items,
      subjectBrief,
    });

    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
      outputFormat: 'jpeg',
      supabaseUserId,
      feature: 'outfit-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
      logContext: { jobId, outfitTitle: outfit.title },
    });

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'closet-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchImageUrl: `${env.STORAGE_PUBLIC_BASE_URL}/media/${storedFile.storageKey}`,
      sketchStorageKey: storedFile.storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ jobId, outfitTitle: outfit.title, errorCode: code, error }, 'Closet outfit sketch generation failed');
    await closetRepository.updateSketchJob(jobId, {
      status: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
      sketchErrorCode: code,
      sketchErrorMessage: message,
    });
  }
}

async function attachFeedbackIds(
  outfits: Omit<ResolvedOutfit, 'feedbackId' | 'feedback' | 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[],
  formality: string,
  supabaseUserId: string,
): Promise<Omit<ResolvedOutfit, 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[]> {
  const rows = await closetRepository.createOutfitFeedbackRows(
    supabaseUserId,
    formality,
    outfits.map((outfit) => ({ title: outfit.title, itemIds: outfit.items.map((item) => item.id) })),
  );
  return outfits.map((outfit, index) => ({ ...outfit, feedbackId: rows[index]!.id, feedback: null }));
}

async function attachSketchJobs(
  outfits: Omit<ResolvedOutfit, 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[],
  supabaseUserId: string,
): Promise<ResolvedOutfit[]> {
  const profile = await profileRepository.findByUserId(supabaseUserId);
  const subjectBrief = profile
    ? buildSubjectRenderingBrief({
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyType: (profile as any).bodyType ?? null,
        weightDistribution: (profile as any).weightDistribution ?? null,
        fitTendency: (profile as any).fitTendency ?? null,
      }).block
    : 'slim neutral fashion figure';

  const jobs = await Promise.all(outfits.map(() => closetRepository.createSketchJob()));

  const withJobs: ResolvedOutfit[] = outfits.map((outfit, index) => ({
    ...outfit,
    sketchJobId: jobs[index]!.id,
    sketchStatus: 'pending',
    sketchImageUrl: null,
  }));

  // Fire-and-forget, bounded-concurrency — the response returns immediately
  // with 'pending' sketch jobs; the client polls each via the existing
  // closet sketch-job endpoint.
  void runWithConcurrencyLimit(withJobs, SKETCH_GENERATION_CONCURRENCY, (outfit) =>
    generateOutfitSketch(outfit.sketchJobId, outfit, subjectBrief, supabaseUserId),
  );

  return withJobs;
}

// Reuses the shared deterministic builder to pick a single hat/bag by
// restricting its candidate pool to just that garment group — avoids a
// separate single-item-pick code path for what's structurally the same
// "formality + variety aware pick from a pool" operation the builder already does.
function pickAccessory(
  group: 'hat' | 'bag',
  closetItems: BuilderItem[],
  targetFormalityRank: number,
  excludeItemIds: ReadonlySet<string>,
): BuilderItem | null {
  const candidates = closetItems.filter((item) => CATEGORY_TO_GROUP[item.category] === group);
  const result = buildDeterministicOutfit({
    closetItems: candidates,
    targetFormalityRank,
    includeLayering: false,
    includeOuterwear: false,
    includeHat: group === 'hat',
    includeBag: group === 'bag',
    excludeItemIds,
  });
  return result.bySlot.hat ?? result.bySlot.bag ?? null;
}

export const closetOutfitsService = {
  async generateOutfits(payload: GenerateClosetOutfitsPayload, supabaseUserId: string) {
    const { itemsById } = await loadIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];

    const [recentlyUsedItemIds, seasonalTrends] = await Promise.all([
      closetRepository.getRecentlyUsedItemIds(supabaseUserId, RECENT_OUTFITS_FOR_VARIETY),
      loadSeasonalTrends(supabaseUserId, payload.hemisphere),
    ]);

    const temperatureC = payload.weatherContext?.apparentTemperatureC ?? payload.weatherContext?.temperatureC ?? null;
    const { includeLayering, includeOuterwear } = weatherGates(temperatureC);
    const targetFormalityRank = TIER_FORMALITY_TARGET[payload.formality] ?? FORMALITY_RANK['Refined Casual'];
    const seedGroupsBySlot = seedRecentGroupsBySlot(recentlyUsedItemIds, itemsById);

    const batch = buildOutfitBatch({
      closetItems,
      targetFormalityRank,
      includeLayering,
      includeOuterwear,
      count: TARGET_OUTFIT_COUNT,
      seedGroupsBySlot,
    });

    const validBatch = batch.filter(isValidOutfit);
    if (validBatch.length === 0) {
      throw new HttpError(
        422,
        'CLOSET_OUTFITS_INVALID',
        'Your closet needs footwear, bottoms, and tops to build a complete outfit.',
      );
    }

    const resolved = validBatch.map((result, index) => ({
      id: `outfit-${index}-${result.itemIds.join('-')}`,
      items: result.itemIds.map((id) => mapClosetItem(itemsById.get(id)!)),
    }));

    const narrationMap = await narrateOutfits({
      outfits: resolved.map((outfit, index) => ({ index, items: outfit.items })),
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      temperatureC,
      weatherCode: payload.weatherContext?.weatherCode,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      seasonalTrends,
      supabaseUserId,
    });

    const withTitles = resolved.map((outfit, index) => {
      const narration = narrationMap.get(index);
      return {
        id: outfit.id,
        title: narration?.title ?? fallbackTitle(payload.formality),
        whyItWorks: narration?.whyItWorks ?? FALLBACK_WHY_IT_WORKS,
        items: outfit.items,
      };
    });

    const withFeedbackIds = await attachFeedbackIds(withTitles, payload.formality, supabaseUserId);
    return { outfits: await attachSketchJobs(withFeedbackIds, supabaseUserId) };
  },

  async generateOutfitVariations(payload: GenerateClosetOutfitVariationsPayload, supabaseUserId: string) {
    const { itemsById } = await loadIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];
    const seasonalTrends = await loadSeasonalTrends(supabaseUserId, payload.hemisphere);

    const validBaseIds = payload.baseItemIds.filter((id) => itemsById.has(id));
    if (validBaseIds.length < 2) {
      throw new HttpError(422, 'INVALID_BASE_OUTFIT', 'The selected outfit no longer matches your closet.');
    }

    const swapItemIds = payload.swapItemIds.filter((id) => validBaseIds.includes(id));
    if (swapItemIds.length === 0) {
      throw new HttpError(422, 'INVALID_SWAP_ITEMS', 'Select 1 or 2 items from the outfit to swap.');
    }
    const keepItemIds = validBaseIds.filter((id) => !swapItemIds.includes(id));

    const temperatureC = payload.weatherContext?.apparentTemperatureC ?? payload.weatherContext?.temperatureC ?? null;
    const targetFormalityRank = TIER_FORMALITY_TARGET[payload.formality] ?? FORMALITY_RANK['Refined Casual'];

    // Each swap slot is constrained to the SAME garment group as the item
    // being replaced (pickVariantReplacements) — a shoe swap only ever offers
    // other shoes, never a different slot's item. Never re-suggest an item
    // already in the base outfit.
    const excludeIds = new Set(validBaseIds);
    const replacementLists = swapItemIds.map((swapId) =>
      pickVariantReplacements(itemsById.get(swapId)!, closetItems, targetFormalityRank, excludeIds, TARGET_OUTFIT_COUNT),
    );

    const variantCount = Math.min(TARGET_OUTFIT_COUNT, ...replacementLists.map((list) => list.length));
    if (variantCount === 0) {
      throw new HttpError(
        502,
        'CLOSET_OUTFITS_INVALID',
        'Your closet does not have another item in the same category to swap in.',
      );
    }

    const resolved = Array.from({ length: variantCount }, (_, index) => {
      const itemIds = [...keepItemIds, ...replacementLists.map((list) => list[index]!.id)];
      return { id: `outfit-variant-${index}-${itemIds.join('-')}`, items: itemIds.map((id) => mapClosetItem(itemsById.get(id)!)) };
    });

    const narrationMap = await narrateOutfits({
      outfits: resolved.map((outfit, index) => ({ index, items: outfit.items })),
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      temperatureC,
      weatherCode: payload.weatherContext?.weatherCode,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      seasonalTrends,
      supabaseUserId,
    });

    const withTitles = resolved.map((outfit, index) => {
      const narration = narrationMap.get(index);
      return {
        id: outfit.id,
        title: narration?.title ?? `${fallbackTitle(payload.formality)} Variation`,
        whyItWorks: narration?.whyItWorks ?? 'A variation on your outfit with a fresh piece swapped in.',
        items: outfit.items,
      };
    });

    const withFeedbackIds = await attachFeedbackIds(withTitles, payload.formality, supabaseUserId);
    return { outfits: await attachSketchJobs(withFeedbackIds, supabaseUserId) };
  },

  // Partial update: adds/removes just the hat/bag slot from an already-shown
  // outfit, keeping every other item, the title, and the rationale exactly as
  // they were — only the item list and sketch change.
  async updateOutfitAccessories(payload: UpdateClosetOutfitAccessoriesPayload, supabaseUserId: string) {
    const { itemsById } = await loadIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];

    const validItemIds = payload.itemIds.filter((id) => itemsById.has(id));
    if (validItemIds.length < 2) {
      throw new HttpError(422, 'INVALID_BASE_OUTFIT', 'This outfit no longer matches your closet.');
    }

    const targetFormalityRank = TIER_FORMALITY_TARGET[payload.formality] ?? FORMALITY_RANK['Refined Casual'];

    const currentHatId = validItemIds.find((id) => CATEGORY_TO_GROUP[itemsById.get(id)!.category] === 'hat');
    const currentBagId = validItemIds.find((id) => CATEGORY_TO_GROUP[itemsById.get(id)!.category] === 'bag');

    let itemIds = validItemIds.filter((id) => id !== currentHatId || payload.includeHat);
    itemIds = itemIds.filter((id) => id !== currentBagId || payload.includeBag);

    if (payload.includeHat && !currentHatId) {
      const hat = pickAccessory('hat', closetItems, targetFormalityRank, new Set(itemIds));
      if (hat) itemIds.push(hat.id);
    }
    if (payload.includeBag && !currentBagId) {
      const bag = pickAccessory('bag', closetItems, targetFormalityRank, new Set(itemIds));
      if (bag) itemIds.push(bag.id);
    }

    const items = itemIds.map((id) => mapClosetItem(itemsById.get(id)!));
    const [feedbackRow] = await closetRepository.createOutfitFeedbackRows(supabaseUserId, payload.formality, [
      { title: payload.title, itemIds },
    ]);

    const outfit = {
      id: `outfit-${itemIds.join('-')}`,
      title: payload.title,
      whyItWorks: payload.whyItWorks,
      items,
      feedbackId: feedbackRow!.id,
      feedback: null as 'love' | 'hate' | null,
    };

    const [withSketch] = await attachSketchJobs([outfit], supabaseUserId);
    return { outfit: withSketch! };
  },

  async setOutfitFeedback(feedbackId: string, supabaseUserId: string, feedback: 'love' | 'hate' | null) {
    const updated = await closetRepository.setOutfitFeedback(feedbackId, supabaseUserId, feedback);
    if (!updated) {
      throw new HttpError(404, 'OUTFIT_FEEDBACK_NOT_FOUND', 'No generated outfit exists for the provided id.');
    }
    return { feedbackId, feedback };
  },
};
