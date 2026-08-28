import { HttpError } from '../../lib/http-error.js';
import { openAiClient } from '../../ai/openai-client.js';
import {
  buildClosetOutfitsSystemPrompt,
  buildClosetOutfitsUserPrompt,
  buildClosetOutfitVariationsUserPrompt,
  type ClosetOutfitIndexItem,
} from '../../ai/prompts/closet-outfits.prompts.js';
import { closetRepository } from './closet.repository.js';
import { mapClosetItem } from './closet-response-mapper.js';
import { CLOSET_OUTFITS_JSON_SCHEMA, closetOutfitsLlmResponseSchema } from './closet.schemas.js';
import type { GenerateClosetOutfitsPayload, GenerateClosetOutfitVariationsPayload } from './closet.validation.js';

const MIN_WARDROBE_SIZE = 5;
const MAX_ATTEMPTS = 3;

type ResolvedOutfit = {
  id: string;
  title: string;
  whyItWorks: string;
  items: ReturnType<typeof mapClosetItem>[];
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
): ResolvedOutfit[] {
  const resolved: ResolvedOutfit[] = [];

  for (let i = 0; i < outfits.length; i++) {
    const outfit = outfits[i]!;
    const uniqueIds = [...new Set(outfit.itemIds)];
    const validIds = uniqueIds.filter((id) => itemsById.has(id));

    // Drop outfits where the model referenced an id outside the wardrobe index,
    // or ended up with fewer than 2 real items after filtering.
    if (validIds.length < 2 || validIds.length !== uniqueIds.length) continue;

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
  const validIds = new Set(params.index.map((item) => item.id));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await openAiClient.createStructuredResponse({
      schema: closetOutfitsLlmResponseSchema,
      jsonSchema: CLOSET_OUTFITS_JSON_SCHEMA,
      instructions: buildClosetOutfitsSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: params.userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'outfit-generation',
    });

    // Accept as soon as at least 3 of the 5 outfits reference only real ids —
    // resolveOutfits() filters the rest, and the caller surfaces however many survive.
    const usableCount = result.outfits.filter((outfit) => outfit.itemIds.every((id) => validIds.has(id))).length;
    if (usableCount >= 3) {
      return result.outfits;
    }
  }

  throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not assemble outfits from your closet. Please try again.');
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

    return { outfits: resolved };
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

    return { outfits: resolved };
  },
};
