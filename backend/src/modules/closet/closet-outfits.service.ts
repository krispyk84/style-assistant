import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import {
  buildClosetOutfitsSystemPrompt,
  buildClosetOutfitsUserPrompt,
  buildClosetOutfitVariationsUserPrompt,
  type ClosetOutfitIndexItem,
  type ClosetOutfitVarietyContext,
} from '../../ai/prompts/closet-outfits.prompts.js';
import { buildClosetOutfitSketchPrompt } from '../../ai/prompts/closet-outfit-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { profileRepository } from '../profile/profile.repository.js';
import { seasonalTrendsService } from '../seasonal-trends/seasonal-trends.service.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import { closetRepository } from './closet.repository.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { CLOSET_OUTFITS_JSON_SCHEMA, closetOutfitsLlmResponseSchema } from './closet.schemas.js';
import type { GenerateClosetOutfitsPayload, GenerateClosetOutfitVariationsPayload } from './closet.validation.js';

function fashionGenderForProfile(gender: string | null | undefined): FashionGender {
  return gender === 'woman' ? 'womenswear' : 'menswear';
}

async function loadSeasonalTrends(supabaseUserId: string, hemisphere?: Hemisphere) {
  if (!hemisphere) return null;
  const profile = await profileRepository.findByUserId(supabaseUserId);
  return seasonalTrendsService.getCurrentTrendProfile(fashionGenderForProfile(profile?.gender), hemisphere);
}

const MIN_WARDROBE_SIZE = 5;
const MAX_ATTEMPTS = 4;
const TARGET_OUTFIT_COUNT = 5;
const SKETCH_STAGGER_MS = 400;
// Two batches' worth of outfits (a base 5 + a variations 5) — wide enough to
// meaningfully steer the model away from repeats, narrow enough that older
// generations stop suppressing an item forever.
const RECENT_OUTFITS_FOR_VARIETY = 10;

// A generated outfit must cover both of these slots to count as "complete" —
// the LLM is instructed to do this, but instructions alone aren't reliable
// enough to skip validating it server-side.
const BOTTOM_CATEGORIES = new Set(['Trousers', 'Denim', 'Shorts', 'Suit']);
const FOOTWEAR_CATEGORIES = new Set(['Shoes', 'Sneakers', 'Loafers', 'Boots']);

function isCompleteOutfit(categories: string[]): boolean {
  return categories.some((c) => BOTTOM_CATEGORIES.has(c)) && categories.some((c) => FOOTWEAR_CATEGORIES.has(c));
}

type MappedClosetItem = ReturnType<typeof mapClosetItem>;

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
  const items = await closetRepository.getItems(supabaseUserId);
  if (items.length < MIN_WARDROBE_SIZE) {
    throw new HttpError(
      422,
      'INSUFFICIENT_ITEMS',
      `Add at least ${MIN_WARDROBE_SIZE} closet items before generating full outfits.`,
    );
  }

  // Shuffled per request — LLMs skew toward items earlier in a long list, so
  // sending the same order every time compounds that bias into the same
  // handful of items getting picked call after call regardless of prompt
  // instructions.
  const shuffled = [...items].sort(() => Math.random() - 0.5);

  const index: ClosetOutfitIndexItem[] = shuffled.map((item) => ({
    id: item.id,
    name: item.title,
    category: item.category,
    color_family: item.colorFamily ?? null,
    formality: item.formality ?? null,
    silhouette: item.silhouette ?? null,
    season: item.season ?? null,
    material: item.material ?? null,
    brand: item.brand || null,
  }));

  const itemsById = new Map(items.map((item) => [item.id, item]));

  return { index, itemsById };
}

async function buildVarietyContext(
  supabaseUserId: string,
  itemsById: Map<string, Awaited<ReturnType<typeof closetRepository.getItems>>[number]>,
): Promise<ClosetOutfitVarietyContext> {
  const [recentIds, preference] = await Promise.all([
    closetRepository.getRecentlyUsedItemIds(supabaseUserId, RECENT_OUTFITS_FOR_VARIETY),
    closetRepository.getPreferenceItemIds(supabaseUserId),
  ]);

  const toNamed = (ids: string[]) =>
    ids
      .map((id) => itemsById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, name: item.title }));

  return {
    recentlyUsedItems: toNamed(recentIds),
    preference: { loved: toNamed(preference.loved), hated: toNamed(preference.hated) },
  };
}

function resolveOutfits(
  outfits: { title: string; itemIds: string[]; whyItWorks: string }[],
  itemsById: Map<string, Awaited<ReturnType<typeof closetRepository.getItems>>[number]>,
  mustIncludeItemIds?: string[],
): Omit<ResolvedOutfit, 'feedbackId' | 'feedback' | 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[] {
  const resolved: Omit<ResolvedOutfit, 'feedbackId' | 'feedback' | 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[] = [];

  for (let i = 0; i < outfits.length; i++) {
    const outfit = outfits[i]!;
    const uniqueIds = [...new Set(outfit.itemIds)];
    const validIds = uniqueIds.filter((id) => itemsById.has(id));

    // Drop outfits where the model referenced an id outside the wardrobe index,
    // or ended up with fewer than 2 real items after filtering.
    if (validIds.length < 2 || validIds.length !== uniqueIds.length) continue;

    // Drop outfits missing a bottom or footwear — an incomplete outfit is a
    // failed generation, not a partial success worth showing.
    const categories = validIds.map((id) => itemsById.get(id)!.category);
    if (!isCompleteOutfit(categories)) continue;

    // Variations only: the client explicitly asked to keep certain items
    // unchanged — a variation that dropped one is invalid, not a partial success.
    if (mustIncludeItemIds && !mustIncludeItemIds.every((id) => validIds.includes(id))) continue;

    resolved.push({
      id: `outfit-${i}-${validIds.join('-')}`,
      title: outfit.title,
      whyItWorks: outfit.whyItWorks,
      items: validIds.map((id) => mapClosetItem(itemsById.get(id)!)),
    });
  }

  return resolved;
}

async function requestOutfits(params: {
  index: ClosetOutfitIndexItem[];
  userPrompt: string;
  supabaseUserId: string;
  mustIncludeItemIds?: string[];
}): Promise<{ title: string; itemIds: string[]; whyItWorks: string }[]> {
  const categoryById = new Map(params.index.map((item) => [item.id, item.category]));
  const isUsable = (outfit: { itemIds: string[] }) => {
    if (!outfit.itemIds.every((id) => categoryById.has(id))) return false;
    const categories = outfit.itemIds.map((id) => categoryById.get(id)!);
    if (!isCompleteOutfit(categories)) return false;
    if (params.mustIncludeItemIds && !params.mustIncludeItemIds.every((id) => outfit.itemIds.includes(id))) return false;
    return true;
  };

  // Accumulate usable outfits ACROSS attempts rather than requiring a single
  // attempt to score 5/5 — a retry that got 4/5 right shouldn't discard the
  // one good outfit from a prior attempt that only got 2/5 right. This is
  // what actually fixed generations settling for 3 outfits instead of 5: the
  // old version replaced the "best" attempt wholesale each retry instead of
  // combining what already validated.
  const accumulated: { title: string; itemIds: string[]; whyItWorks: string }[] = [];
  const seenKeys = new Set<string>();

  for (let attempt = 0; attempt < MAX_ATTEMPTS && accumulated.length < TARGET_OUTFIT_COUNT; attempt++) {
    const result = await openAiClient.createStructuredResponse({
      schema: closetOutfitsLlmResponseSchema,
      jsonSchema: CLOSET_OUTFITS_JSON_SCHEMA,
      instructions: buildClosetOutfitsSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: params.userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'outfit-generation',
    });

    for (const outfit of result.outfits) {
      if (!isUsable(outfit)) continue;
      const key = [...outfit.itemIds].sort().join('|');
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      accumulated.push(outfit);
      if (accumulated.length >= TARGET_OUTFIT_COUNT) break;
    }
  }

  if (accumulated.length >= 3) {
    return accumulated.slice(0, TARGET_OUTFIT_COUNT);
  }

  throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not assemble outfits from your closet. Please try again.');
}

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

  // Fire-and-forget, staggered — the response returns immediately with 'pending'
  // sketch jobs; the client polls each via the existing closet sketch-job endpoint.
  void Promise.all(
    withJobs.map((outfit, index) =>
      new Promise<void>((resolve) => setTimeout(resolve, index * SKETCH_STAGGER_MS)).then(() =>
        generateOutfitSketch(outfit.sketchJobId, outfit, subjectBrief, supabaseUserId),
      ),
    ),
  );

  return withJobs;
}

export const closetOutfitsService = {
  async generateOutfits(payload: GenerateClosetOutfitsPayload, supabaseUserId: string) {
    const { index, itemsById } = await loadIndex(supabaseUserId);
    const [variety, seasonalTrends] = await Promise.all([
      buildVarietyContext(supabaseUserId, itemsById),
      loadSeasonalTrends(supabaseUserId, payload.hemisphere),
    ]);

    const userPrompt = buildClosetOutfitsUserPrompt({
      index,
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      variety,
      seasonalTrends,
    });

    const outfits = await requestOutfits({ index, userPrompt, supabaseUserId });
    const resolved = resolveOutfits(outfits, itemsById);

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not assemble outfits from your closet. Please try again.');
    }

    const withFeedbackIds = await attachFeedbackIds(resolved, payload.formality, supabaseUserId);
    return { outfits: await attachSketchJobs(withFeedbackIds, supabaseUserId) };
  },

  async generateOutfitVariations(payload: GenerateClosetOutfitVariationsPayload, supabaseUserId: string) {
    const { index, itemsById } = await loadIndex(supabaseUserId);
    const [variety, seasonalTrends] = await Promise.all([
      buildVarietyContext(supabaseUserId, itemsById),
      loadSeasonalTrends(supabaseUserId, payload.hemisphere),
    ]);

    const validBaseIds = payload.baseItemIds.filter((id) => itemsById.has(id));
    if (validBaseIds.length < 2) {
      throw new HttpError(422, 'INVALID_BASE_OUTFIT', 'The selected outfit no longer matches your closet.');
    }

    const swapItemIds = payload.swapItemIds.filter((id) => validBaseIds.includes(id));
    if (swapItemIds.length === 0) {
      throw new HttpError(422, 'INVALID_SWAP_ITEMS', 'Select 1 or 2 items from the outfit to swap.');
    }
    const keepItemIds = validBaseIds.filter((id) => !swapItemIds.includes(id));

    const userPrompt = buildClosetOutfitVariationsUserPrompt({
      index,
      baseItemIds: validBaseIds,
      swapItemIds,
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      variety,
      seasonalTrends,
    });

    const outfits = await requestOutfits({ index, userPrompt, supabaseUserId, mustIncludeItemIds: keepItemIds });
    const resolved = resolveOutfits(outfits, itemsById, keepItemIds);

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not generate variations for that outfit. Please try again.');
    }

    const withFeedbackIds = await attachFeedbackIds(resolved, payload.formality, supabaseUserId);
    return { outfits: await attachSketchJobs(withFeedbackIds, supabaseUserId) };
  },

  async setOutfitFeedback(feedbackId: string, supabaseUserId: string, feedback: 'love' | 'hate' | null) {
    const updated = await closetRepository.setOutfitFeedback(feedbackId, supabaseUserId, feedback);
    if (!updated) {
      throw new HttpError(404, 'OUTFIT_FEEDBACK_NOT_FOUND', 'No generated outfit exists for the provided id.');
    }
    return { feedbackId, feedback };
  },
};
