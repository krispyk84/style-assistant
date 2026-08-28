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
} from '../../ai/prompts/closet-outfits.prompts.js';
import { buildClosetOutfitSketchPrompt } from '../../ai/prompts/closet-outfit-sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { profileRepository } from '../profile/profile.repository.js';
import { closetRepository } from './closet.repository.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { CLOSET_OUTFITS_JSON_SCHEMA, closetOutfitsLlmResponseSchema } from './closet.schemas.js';
import type { GenerateClosetOutfitsPayload, GenerateClosetOutfitVariationsPayload } from './closet.validation.js';

const MIN_WARDROBE_SIZE = 5;
const MAX_ATTEMPTS = 4;
const TARGET_OUTFIT_COUNT = 5;
const SKETCH_STAGGER_MS = 400;

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

  const index: ClosetOutfitIndexItem[] = items.map((item) => ({
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

function resolveOutfits(
  outfits: { title: string; itemIds: string[]; whyItWorks: string }[],
  itemsById: Map<string, Awaited<ReturnType<typeof closetRepository.getItems>>[number]>,
): Omit<ResolvedOutfit, 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[] {
  const resolved: Omit<ResolvedOutfit, 'sketchJobId' | 'sketchStatus' | 'sketchImageUrl'>[] = [];

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
}): Promise<{ title: string; itemIds: string[]; whyItWorks: string }[]> {
  const categoryById = new Map(params.index.map((item) => [item.id, item.category]));
  let best: { outfits: { title: string; itemIds: string[]; whyItWorks: string }[]; usableCount: number } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await openAiClient.createStructuredResponse({
      schema: closetOutfitsLlmResponseSchema,
      jsonSchema: CLOSET_OUTFITS_JSON_SCHEMA,
      instructions: buildClosetOutfitsSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: params.userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'outfit-generation',
    });

    // resolveOutfits() re-validates and filters the rest, but retrying here
    // gives the model a real chance to fix incomplete/invalid outfits instead
    // of the caller silently surfacing fewer than TARGET_OUTFIT_COUNT. Keep
    // the best attempt seen so far so a later, worse retry can't discard a
    // good earlier one.
    const usableCount = result.outfits.filter((outfit) => {
      if (!outfit.itemIds.every((id) => categoryById.has(id))) return false;
      const categories = outfit.itemIds.map((id) => categoryById.get(id)!);
      return isCompleteOutfit(categories);
    }).length;

    if (!best || usableCount > best.usableCount) {
      best = { outfits: result.outfits, usableCount };
    }
    if (usableCount >= TARGET_OUTFIT_COUNT) {
      return result.outfits;
    }
  }

  if (best && best.usableCount >= 3) {
    return best.outfits;
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

    const userPrompt = buildClosetOutfitsUserPrompt({
      index,
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      trendiness: payload.trendiness,
    });

    const outfits = await requestOutfits({ index, userPrompt, supabaseUserId });
    const resolved = resolveOutfits(outfits, itemsById);

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not assemble outfits from your closet. Please try again.');
    }

    return { outfits: await attachSketchJobs(resolved, supabaseUserId) };
  },

  async generateOutfitVariations(payload: GenerateClosetOutfitVariationsPayload, supabaseUserId: string) {
    const { index, itemsById } = await loadIndex(supabaseUserId);

    const validBaseIds = payload.baseItemIds.filter((id) => itemsById.has(id));
    if (validBaseIds.length < 2) {
      throw new HttpError(422, 'INVALID_BASE_OUTFIT', 'The selected outfit no longer matches your closet.');
    }

    const userPrompt = buildClosetOutfitVariationsUserPrompt({
      index,
      baseItemIds: validBaseIds,
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      trendiness: payload.trendiness,
    });

    const outfits = await requestOutfits({ index, userPrompt, supabaseUserId });
    const resolved = resolveOutfits(outfits, itemsById);

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not generate variations for that outfit. Please try again.');
    }

    return { outfits: await attachSketchJobs(resolved, supabaseUserId) };
  },
};
