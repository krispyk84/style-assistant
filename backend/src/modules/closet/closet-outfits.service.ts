import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { runWithConcurrencyLimit } from '../../lib/concurrency-limit.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import {
  buildClosetOutfitsChoiceSystemPrompt,
  buildClosetOutfitsChoiceUserPrompt,
  buildClosetOutfitVariationsChoiceUserPrompt,
  type ClosetOutfitIndexItem,
  type ClosetOutfitSlotShortlists,
  type ClosetOutfitVarietyContext,
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
import {
  closetOutfitsChoiceResponseSchema,
  buildClosetOutfitsChoiceJsonSchema,
  buildClosetOutfitVariationsChoiceJsonSchema,
} from './closet.schemas.js';
import {
  buildAccessoryShortlist,
  buildFrameworkBreakdown,
  buildOutfitSlotShortlists,
  buildVariantCandidates,
  effectiveAllowedGroups,
  filterByFormalityBand,
  normalizeSuitDualRole,
  pickAccessory,
  type FrameworkBreakdown,
} from './closet-outfit-builder.js';
import {
  ACCESSORY_GROUPS,
  FORMALITY_RANK,
  resolveGarmentGroup,
  GROUP_TO_SLOTS,
  requiredSlotsForTier,
  SLOT_GROUPS,
  TIER_FORMALITY_TARGET,
  tierForFormalityRank,
  weatherGates,
  type OutfitSlot,
  type TierSlug,
} from './closet-taxonomy.js';
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
// meaningfully steer the model away from repeats, narrow enough that older
// generations stop suppressing an item forever.
const RECENT_OUTFITS_FOR_VARIETY = 10;

type MappedClosetItem = ReturnType<typeof mapClosetItem>;
type BuilderItem = Awaited<ReturnType<typeof closetRepository.getItems>>[number];

type ResolvedOutfit = {
  id: string;
  title: string;
  whyItWorks: string;
  items: MappedClosetItem[];
  framework: FrameworkBreakdown;
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

async function buildVarietyContext(
  supabaseUserId: string,
  itemsById: Map<string, BuilderItem>,
): Promise<ClosetOutfitVarietyContext> {
  const [recentIds, preference] = await Promise.all([
    closetRepository.getRecentlyUsedItemIds(supabaseUserId, RECENT_OUTFITS_FOR_VARIETY),
    closetRepository.getPreferenceItemIds(supabaseUserId),
  ]);

  const toNamed = (ids: string[]) =>
    ids
      .map((id) => itemsById.get(id))
      .filter((item): item is BuilderItem => Boolean(item))
      .map((item) => ({ id: item.id, name: item.title }));

  return {
    recentlyUsedItems: toNamed(recentIds),
    preference: { loved: toNamed(preference.loved), hated: toNamed(preference.hated) },
  };
}

function toIndexItem(item: BuilderItem): ClosetOutfitIndexItem {
  return {
    id: item.id,
    name: item.title,
    category: item.category,
    color_family: item.colorFamily ?? null,
    formality: item.formality ?? null,
    silhouette: item.silhouette ?? null,
    season: item.season ?? null,
    material: item.material ?? null,
    brand: item.brand || null,
  };
}

// Classifies a flat resolved item-id list back into slots (plus any multi-
// pick "Additional Accessories" items, which don't fit a single-item slot)
// for the framework breakdown — mirrors trips.service.ts's equivalent.
function classifyItemsBySlot(
  itemIds: string[],
  itemsById: Map<string, BuilderItem>,
): { bySlot: Partial<Record<OutfitSlot, BuilderItem>>; accessoryItems: BuilderItem[] } {
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};
  const accessoryItems: BuilderItem[] = [];
  for (const id of itemIds) {
    const item = itemsById.get(id);
    if (!item) continue;
    const group = resolveGarmentGroup(item);
    const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
    if (slot) {
      bySlot[slot] = item;
    } else if (group && ACCESSORY_GROUPS.includes(group)) {
      accessoryItems.push(item);
    }
  }
  normalizeSuitDualRole(bySlot);
  return { bySlot, accessoryItems };
}

type ChoiceOutfit = {
  index: number;
  title: string;
  whyItWorks: string;
  chosenIds: Record<string, string | null>;
  accessoryIds: string[];
};

// Resolves the model's per-slot choices back into real items — validates
// every chosen id against the exact shortlist offered for its slot (a
// defensive double-check on top of the schema's own enum constraint), merges
// in any items the caller wants fixed on every outfit (e.g. kept pieces for
// a variant swap) plus any chosen additional accessories, and drops any
// outfit that duplicates an earlier one's final item set. A null chosenIds
// value means the model deliberately left that optional slot out.
function resolveChoiceOutfits(params: {
  outfits: ChoiceOutfit[];
  idsBySlot: Record<string, string[]>;
  validAccessoryIds: ReadonlySet<string>;
  fixedItemIds: string[];
  itemsById: Map<string, BuilderItem>;
  idPrefix: string;
  tier: TierSlug;
}): { id: string; title: string; whyItWorks: string; items: MappedClosetItem[]; framework: FrameworkBreakdown }[] {
  const validIdSets = new Map(Object.entries(params.idsBySlot).map(([slot, ids]) => [slot, new Set(ids)]));
  const seenKeys = new Set<string>();
  const resolved: { id: string; title: string; whyItWorks: string; items: MappedClosetItem[]; framework: FrameworkBreakdown }[] = [];

  for (const outfit of params.outfits) {
    const chosenEntries = Object.entries(outfit.chosenIds).filter((entry): entry is [string, string] => entry[1] !== null);
    if (chosenEntries.length === 0) continue;

    const valid = chosenEntries.every(([slot, id]) => validIdSets.get(slot)?.has(id));
    if (!valid) continue;

    // Suit dual-role: bottoms/secondaryTop may legitimately share the same
    // Suit id (one physical piece is both trousers and jacket) — force them
    // consistent rather than rejecting the outfit or double-counting the item.
    const bySlot = new Map(chosenEntries);
    const bottomsItem = bySlot.has('bottoms') ? params.itemsById.get(bySlot.get('bottoms')!) : undefined;
    const secondaryTopItem = bySlot.has('secondaryTop') ? params.itemsById.get(bySlot.get('secondaryTop')!) : undefined;
    if (bottomsItem && resolveGarmentGroup(bottomsItem) === 'suit' && bySlot.has('secondaryTop')) {
      bySlot.set('secondaryTop', bottomsItem.id);
    } else if (secondaryTopItem && resolveGarmentGroup(secondaryTopItem) === 'suit' && bySlot.has('bottoms')) {
      bySlot.set('bottoms', secondaryTopItem.id);
    }

    // Any OTHER duplicate (two different slots landing on the same non-suit
    // id) is a real model error, not a suit — reject that outfit.
    const idCounts = new Map<string, number>();
    for (const id of bySlot.values()) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const hasIllegitimateDuplicate = [...idCounts.entries()].some(([id, count]) => {
      if (count <= 1) return false;
      const item = params.itemsById.get(id);
      return !(item && resolveGarmentGroup(item) === 'suit');
    });
    if (hasIllegitimateDuplicate) continue;

    const accessoryIds = [...new Set(outfit.accessoryIds)].filter((id) => params.validAccessoryIds.has(id));
    const chosenIds = [...new Set(bySlot.values())]; // dedupe the suit id appearing under both slots
    const itemIds = [...params.fixedItemIds, ...chosenIds, ...accessoryIds];
    const key = [...itemIds].sort().join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const { bySlot: framedBySlot, accessoryItems: framedAccessoryItems } = classifyItemsBySlot(itemIds, params.itemsById);

    resolved.push({
      id: `${params.idPrefix}-${outfit.index}-${itemIds.join('-')}`,
      title: outfit.title,
      whyItWorks: outfit.whyItWorks,
      items: itemIds.map((id) => mapClosetItem(params.itemsById.get(id)!)),
      framework: buildFrameworkBreakdown({ tier: params.tier, bySlot: framedBySlot, accessoryItems: framedAccessoryItems }),
    });
  }

  return resolved;
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
  // closet sketch-job endpoint. .catch() is a backstop against generateOutfitSketch's
  // own failure-path DB write itself throwing, which would otherwise escape
  // as an unhandled promise rejection.
  runWithConcurrencyLimit(withJobs, SKETCH_GENERATION_CONCURRENCY, (outfit) =>
    generateOutfitSketch(outfit.sketchJobId, outfit, subjectBrief, supabaseUserId),
  ).catch((error) => {
    logger.error({ supabaseUserId, error }, 'Closet outfit sketch batch generation failed');
  });

  return withJobs;
}

// Reuses the shared deterministic builder to pick a single hat/bag by
// restricting its candidate pool to just that garment group — a single,
// low-stakes accessory addition to an already-composed outfit doesn't
// warrant its own LLM round-trip the way full outfit assembly does.
// Last-resort, no-exceptions guarantee: every outfit must have footwear, and
// on a Formal-target tier it must be a dressy pair (dress shoes/loafers) —
// not left to chance even though the schema already requires a valid
// footwear choice per outfit. Mutates outfits in place, appending a tier-
// restricted, formality-preferenced item straight from the closet (bypassing
// the shortlist) for the rare case a resolved outfit still came out without
// one.
function ensureFootwearPresent(
  outfits: { items: MappedClosetItem[]; framework: FrameworkBreakdown }[],
  closetItems: BuilderItem[],
  tier: TierSlug,
  targetFormalityRank: number,
): void {
  for (const outfit of outfits) {
    const hasFootwear = outfit.items.some((item) => SLOT_GROUPS.footwear.includes(resolveGarmentGroup(item) ?? ''));
    if (hasFootwear) continue;

    const usedIds = new Set(outfit.items.map((item) => item.id));
    const restrictedGroups = effectiveAllowedGroups('footwear', tier);
    let candidates = closetItems.filter(
      (item) => restrictedGroups.includes(resolveGarmentGroup(item) ?? '') && !usedIds.has(item.id),
    );
    if (candidates.length === 0) {
      candidates = closetItems.filter(
        (item) => SLOT_GROUPS.footwear.includes(resolveGarmentGroup(item) ?? '') && !usedIds.has(item.id),
      );
    }
    if (candidates.length === 0) continue;
    candidates = filterByFormalityBand(candidates, targetFormalityRank);
    const picked = candidates[0]!;
    outfit.items = [...outfit.items, mapClosetItem(picked)];
    const footwearSlot = outfit.framework.slots.find((slot) => slot.label === 'Footwear');
    if (footwearSlot) footwearSlot.items = [{ title: picked.title, closetItemId: picked.id }];
  }
}

export const closetOutfitsService = {
  async generateOutfits(payload: GenerateClosetOutfitsPayload, supabaseUserId: string) {
    const { itemsById } = await loadIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];

    const [variety, seasonalTrends] = await Promise.all([
      buildVarietyContext(supabaseUserId, itemsById),
      loadSeasonalTrends(supabaseUserId, payload.hemisphere),
    ]);

    const temperatureC = payload.weatherContext?.apparentTemperatureC ?? payload.weatherContext?.temperatureC ?? null;
    const targetFormalityRank = TIER_FORMALITY_TARGET[payload.formality] ?? FORMALITY_RANK['Refined Casual'];
    const tier = tierForFormalityRank(targetFormalityRank);
    const { includeThermalLayer, includeOuterwear } = weatherGates(temperatureC, tier);

    const shortlists = buildOutfitSlotShortlists({
      closetItems,
      targetFormalityRank,
      tier,
      includeThermalLayer,
      includeOuterwear,
    });
    const accessoryShortlist = buildAccessoryShortlist(closetItems, targetFormalityRank);

    const slots = Object.keys(shortlists).filter((slot) => (shortlists[slot as keyof typeof shortlists]?.length ?? 0) > 0);
    if (!slots.includes('footwear') || !slots.includes('bottoms') || !slots.includes('primaryTop')) {
      throw new HttpError(
        422,
        'CLOSET_OUTFITS_INVALID',
        'Your closet needs footwear, bottoms, and a top to build a complete outfit.',
      );
    }

    const requiredSlots = requiredSlotsForTier(tier).filter((slot) => slots.includes(slot));
    const optionalSlots = new Set(slots.filter((slot) => !requiredSlots.includes(slot as OutfitSlot)));

    const shortlistsForPrompt: ClosetOutfitSlotShortlists = {};
    const idsBySlot: Record<string, string[]> = {};
    for (const slot of slots) {
      const items = shortlists[slot as keyof typeof shortlists]!;
      shortlistsForPrompt[slot] = items.map(toIndexItem);
      idsBySlot[slot] = items.map((item) => item.id);
    }

    const userPrompt = buildClosetOutfitsChoiceUserPrompt({
      shortlists: shortlistsForPrompt,
      optionalSlots,
      accessoryShortlist: accessoryShortlist.map(toIndexItem),
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      temperatureC,
      weatherCode: payload.weatherContext?.weatherCode,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      variety,
      seasonalTrends,
    });

    const aiResult = await openAiClient.createStructuredResponse({
      schema: closetOutfitsChoiceResponseSchema,
      jsonSchema: buildClosetOutfitsChoiceJsonSchema({
        slots,
        requiredSlots,
        idsBySlot,
        accessoryIds: accessoryShortlist.map((item) => item.id),
        count: TARGET_OUTFIT_COUNT,
      }),
      instructions: buildClosetOutfitsChoiceSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId,
      feature: 'outfit-generation',
    });

    const resolved = resolveChoiceOutfits({
      outfits: aiResult.outfits,
      idsBySlot,
      validAccessoryIds: new Set(accessoryShortlist.map((item) => item.id)),
      fixedItemIds: [],
      itemsById,
      idPrefix: 'outfit',
      tier,
    });

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not assemble outfits from your closet. Please try again.');
    }
    ensureFootwearPresent(resolved, closetItems, tier, targetFormalityRank);

    const withFeedbackIds = await attachFeedbackIds(resolved, payload.formality, supabaseUserId);
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
    // being replaced — a shoe swap only ever offers other shoes. The
    // shortlist is generous (not just a handful) so the model can reason
    // about which real replacement actually coordinates with the kept pieces.
    const excludeIds = new Set(validBaseIds);
    const slots: string[] = [];
    const idsBySlot: Record<string, string[]> = {};
    const swapShortlists: ClosetOutfitSlotShortlists = {};

    for (const swapId of swapItemIds) {
      const originalItem = itemsById.get(swapId)!;
      const group = resolveGarmentGroup(originalItem);
      const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
      if (!slot) continue;
      const candidates = buildVariantCandidates(originalItem, closetItems, targetFormalityRank, excludeIds);
      if (candidates.length === 0) continue;
      slots.push(slot);
      idsBySlot[slot] = candidates.map((item) => item.id);
      swapShortlists[slot] = candidates.map(toIndexItem);
    }

    if (slots.length === 0) {
      throw new HttpError(
        502,
        'CLOSET_OUTFITS_INVALID',
        'Your closet does not have another item in the same category to swap in.',
      );
    }

    const keepItems = keepItemIds.map((id) => toIndexItem(itemsById.get(id)!));

    const userPrompt = buildClosetOutfitVariationsChoiceUserPrompt({
      keepItems,
      swapShortlists,
      formality: payload.formality,
      weatherSummary: payload.weatherContext?.summary,
      weatherStylingHint: payload.weatherContext?.stylingHint,
      season: payload.weatherContext?.season,
      temperatureC,
      weatherCode: payload.weatherContext?.weatherCode,
      trendiness: payload.trendiness,
      additionalDetails: payload.additionalDetails,
      seasonalTrends,
    });

    const aiResult = await openAiClient.createStructuredResponse({
      schema: closetOutfitsChoiceResponseSchema,
      jsonSchema: buildClosetOutfitVariationsChoiceJsonSchema({
        slots,
        requiredSlots: slots,
        idsBySlot,
        accessoryIds: [],
        maxCount: TARGET_OUTFIT_COUNT,
      }),
      instructions: buildClosetOutfitsChoiceSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId,
      feature: 'outfit-generation',
    });

    const resolved = resolveChoiceOutfits({
      outfits: aiResult.outfits,
      idsBySlot,
      validAccessoryIds: new Set(),
      fixedItemIds: keepItemIds,
      itemsById,
      idPrefix: 'outfit-variant',
      tier: tierForFormalityRank(targetFormalityRank),
    });

    if (resolved.length === 0) {
      throw new HttpError(502, 'CLOSET_OUTFITS_INVALID', 'Could not generate variations for that outfit. Please try again.');
    }

    const withFeedbackIds = await attachFeedbackIds(resolved, payload.formality, supabaseUserId);
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
    const tier = tierForFormalityRank(targetFormalityRank);

    const currentHatId = validItemIds.find((id) => resolveGarmentGroup(itemsById.get(id)!) === 'hat');
    const currentBagId = validItemIds.find((id) => resolveGarmentGroup(itemsById.get(id)!) === 'bag');

    let itemIds = validItemIds.filter((id) => id !== currentHatId || payload.includeHat);
    itemIds = itemIds.filter((id) => id !== currentBagId || payload.includeBag);

    if (payload.includeHat && !currentHatId) {
      const hat = pickAccessory('hat', closetItems, tier, targetFormalityRank, new Set(itemIds));
      if (hat) itemIds.push(hat.id);
    }
    if (payload.includeBag && !currentBagId) {
      const bag = pickAccessory('bag', closetItems, tier, targetFormalityRank, new Set(itemIds));
      if (bag) itemIds.push(bag.id);
    }

    const items = itemIds.map((id) => mapClosetItem(itemsById.get(id)!));
    const [feedbackRow] = await closetRepository.createOutfitFeedbackRows(supabaseUserId, payload.formality, [
      { title: payload.title, itemIds },
    ]);

    const { bySlot: framedBySlot, accessoryItems: framedAccessoryItems } = classifyItemsBySlot(itemIds, itemsById);

    const outfit = {
      id: `outfit-${itemIds.join('-')}`,
      title: payload.title,
      whyItWorks: payload.whyItWorks,
      items,
      framework: buildFrameworkBreakdown({ tier, bySlot: framedBySlot, accessoryItems: framedAccessoryItems }),
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
