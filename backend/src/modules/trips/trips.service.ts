import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import {
  buildTripOutfitsPrompt,
  buildTripDaySketchPrompt,
  buildRegenerateDayPrompt,
  buildTripDayShapePrompt,
  buildTripDayNarrationSystemPrompt,
  buildTripDayNarrationUserPrompt,
  type TripDayToNarrate,
} from '../../ai/prompts/trips.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError, HttpError } from '../../lib/http-error.js';
import { profileRepository } from '../profile/profile.repository.js';
import { buildClosetIndex } from '../closet/closet-index.js';
import { closetRepository } from '../closet/closet.repository.js';
import { buildDeterministicOutfit, pickVariantReplacements } from '../closet/closet-outfit-builder.js';
import { CATEGORY_TO_GROUP, FORMALITY_RANK, GROUP_TO_SLOTS, TRIP_DAY_TYPE_FORMALITY_TARGET, type OutfitSlot } from '../closet/closet-taxonomy.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import {
  regenerateDayResponseSchema,
  tripOutfitsResponseSchema,
  tripDayShapeResponseSchema,
  tripDayNarrationResponseSchema,
  TRIP_DAY_NARRATION_JSON_SCHEMA,
} from './trips.schemas.js';
import type {
  GenerateTripDayVariantsRequest,
  GenerateTripDayVariantsResponse,
  GenerateTripOutfitsRequest,
  GenerateTripOutfitsResponse,
  RegenerateTripDayRequest,
  TripOutfitDayDto,
  UpdateTripDayAccessoriesRequest,
  UpdateTripDayAccessoriesResponse,
} from '../../contracts/trips.contracts.js';
import type { InputContent } from '../../ai/openai-request-builder.js';

// Mirrors lib/outfit-piece-display.ts's CATEGORY_KEYWORDS['Outerwear'] on the
// frontend — kept as a separate constant here since that file isn't shared
// with the backend. Used to enforce the outerwear cap programmatically for
// the NON-closet (freeform text) path: pure prompt instructions weren't
// reliable enough across ~8 separate, stateless per-day generation calls
// (each day is its own API request with no real memory of prior turns beyond
// a text summary) — the model kept inventing a new jacket per day despite
// being told not to. The fullCloset path enforces the same caps directly on
// real items (enforceClosetSlotCap below) rather than by keyword-matching text.
const OUTERWEAR_KEYWORDS = ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'overcoat', 'jumper', 'overshirt'];

function isOuterwearPiece(piece: string): boolean {
  const lower = piece.toLowerCase();
  return OUTERWEAR_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Walks a day's pieces and rewrites any outerwear piece that would exceed
 * the trip's outerwear cap, forcing reuse of an already-used piece (or
 * dropping it entirely when the cap is 0) instead of trusting the model to
 * have self-limited. `usedOuterwear` is threaded through call to call so a
 * multi-day batch (or a progressive per-day loop, via the caller re-passing
 * the accumulated list each request) converges on the same cap regardless
 * of how many separate days/requests are involved.
 */
function enforceOuterwearCap(
  pieces: string[],
  usedOuterwear: string[],
  cap: number,
): { pieces: string[]; usedOuterwear: string[] } {
  const updatedUsed = [...usedOuterwear];
  const newPieces = pieces.reduce<string[]>((acc, piece) => {
    if (!isOuterwearPiece(piece)) {
      acc.push(piece);
      return acc;
    }
    if (cap <= 0) return acc; // drop outerwear entirely — user asked to pack none

    const existingMatch = updatedUsed.find((used) => used.toLowerCase() === piece.toLowerCase());
    if (existingMatch) {
      acc.push(existingMatch); // normalize wording to the canonical already-used string
      return acc;
    }
    if (updatedUsed.length < cap) {
      updatedUsed.push(piece);
      acc.push(piece);
      return acc;
    }
    // Cap already reached with a genuinely new piece — force reuse instead
    // of letting a new distinct jacket slip through.
    acc.push(updatedUsed[0]!);
    return acc;
  }, []);

  return { pieces: newPieces, usedOuterwear: updatedUsed };
}

/**
 * Same reasoning as enforceOuterwearCap — the "max shoes willing to pack"
 * instruction wasn't reliably holding across ~8 separate, stateless per-day
 * generation calls, so the model would invent a new pair most days. Unlike
 * outerwear, shoes are never dropped even when the cap is reached (or 0) —
 * every day genuinely needs a pair — so this always forces reuse of an
 * already-used pair rather than ever omitting footwear.
 */
function enforceFootwearCap(
  shoes: string,
  usedFootwear: string[],
  cap: number,
): { shoes: string; usedFootwear: string[] } {
  const updatedUsed = [...usedFootwear];
  const existingMatch = updatedUsed.find((used) => used.toLowerCase() === shoes.toLowerCase());
  if (existingMatch) {
    return { shoes: existingMatch, usedFootwear: updatedUsed };
  }
  if (updatedUsed.length < Math.max(1, cap)) {
    updatedUsed.push(shoes);
    return { shoes, usedFootwear: updatedUsed };
  }
  return { shoes: updatedUsed[0]!, usedFootwear: updatedUsed };
}

function parseShoesCap(shoesCount: string | undefined): number {
  if (shoesCount === '4+') return 4;
  const n = Number(shoesCount ?? '2');
  return Number.isFinite(n) && n > 0 ? n : 2;
}

// ── fullCloset (deterministic) helpers ────────────────────────────────────────

type BuilderItem = Awaited<ReturnType<typeof closetRepository.getItems>>[number];
type BuilderProfile = Awaited<ReturnType<typeof profileRepository.findByUserId>>;

function weatherGates(temperatureC: number | null): { includeLayering: boolean; includeOuterwear: boolean } {
  if (temperatureC == null) return { includeLayering: true, includeOuterwear: true };
  if (temperatureC >= 24) return { includeLayering: false, includeOuterwear: false };
  if (temperatureC >= 18) return { includeLayering: false, includeOuterwear: true };
  return { includeLayering: true, includeOuterwear: true };
}

/**
 * Same-purpose real-item equivalent of enforceOuterwearCap/enforceFootwearCap
 * — tracks cap state via display-title strings (matching the existing
 * usedOuterwear/usedFootwear request/response contract, which the frontend
 * already derives and threads across progressive per-day calls) rather than
 * keyword-matching freeform text, since the item is already known structurally.
 */
function enforceClosetSlotCap(params: {
  picked: BuilderItem | undefined;
  usedTitles: string[];
  cap: number;
  allowDrop: boolean;
  closetItems: BuilderItem[];
}): { picked: BuilderItem | undefined; usedTitles: string[] } {
  const { picked, usedTitles, cap, allowDrop, closetItems } = params;
  if (!picked) return { picked, usedTitles };
  if (usedTitles.some((title) => title.toLowerCase() === picked.title.toLowerCase())) {
    return { picked, usedTitles };
  }
  if (allowDrop && cap <= 0) return { picked: undefined, usedTitles };
  const effectiveCap = allowDrop ? cap : Math.max(1, cap);
  if (usedTitles.length < effectiveCap) {
    return { picked, usedTitles: [...usedTitles, picked.title] };
  }
  const reuseTitle = usedTitles[0];
  const reuseItem = reuseTitle
    ? closetItems.find((item) => item.title.toLowerCase() === reuseTitle.toLowerCase())
    : undefined;
  return { picked: reuseItem ?? picked, usedTitles };
}

function mapDaySlotsToDto(bySlot: Partial<Record<OutfitSlot, BuilderItem>>): {
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  closetItemIds: string[];
} {
  const pieces = [bySlot.bottoms, bySlot.tops, bySlot.layering, bySlot.outerwear]
    .filter((item): item is BuilderItem => Boolean(item))
    .map((item) => item.title);
  const accessories = [bySlot.watch, bySlot.sunglasses, bySlot.hat]
    .filter((item): item is BuilderItem => Boolean(item))
    .map((item) => item.title);
  const closetItemIds = Object.values(bySlot)
    .filter((item): item is BuilderItem => Boolean(item))
    .map((item) => item.id);

  return {
    pieces,
    shoes: bySlot.footwear?.title ?? '',
    bag: bySlot.bag?.title ?? null,
    accessories,
    closetItemIds,
  };
}

// Reconstructs a bySlot map from a flat item-id list — needed by
// generateDayVariants/updateDayAccessories, which work with real item ids
// (from a swap/toggle request) rather than a fresh buildDeterministicOutfit
// result that already carries slots.
function buildBySlotFromItemIds(
  itemIds: string[],
  itemsById: Map<string, BuilderItem>,
): Partial<Record<OutfitSlot, BuilderItem>> {
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};
  for (const id of itemIds) {
    const item = itemsById.get(id);
    if (!item) continue;
    const group = CATEGORY_TO_GROUP[item.category];
    const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
    if (slot) bySlot[slot] = item;
  }
  return bySlot;
}

// Reuses the shared deterministic builder to pick a single hat/bag by
// restricting its candidate pool to just that garment group — mirrors
// closet-outfits.service.ts's pickAccessory.
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

const FALLBACK_TRIP_TITLE = 'A Day From Your Closet';
const FALLBACK_TRIP_RATIONALE = 'A complete outfit built entirely from pieces you already own.';

async function narrateTripDays(params: {
  days: TripDayToNarrate[];
  destination: string;
  climateLabel?: string | null;
  avgHighC?: number;
  supabaseUserId: string;
}): Promise<Map<number, { title: string; rationale: string }>> {
  const userPrompt = buildTripDayNarrationUserPrompt({
    days: params.days,
    destination: params.destination,
    climateLabel: params.climateLabel,
    avgHighC: params.avgHighC,
  });

  try {
    const result = await openAiClient.createStructuredResponse({
      schema: tripDayNarrationResponseSchema,
      jsonSchema: TRIP_DAY_NARRATION_JSON_SCHEMA,
      instructions: buildTripDayNarrationSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'trip-generation',
    });
    return new Map(result.days.map((day) => [day.index, { title: day.title, rationale: day.rationale }]));
  } catch (error) {
    // Narration is flavor text on top of already-real, already-valid items —
    // a narration failure shouldn't block showing the day itself.
    const { code } = describeError(error);
    logger.warn({ errorCode: code, error }, 'Trip day narration failed — falling back to generic title/rationale');
    return new Map();
  }
}

function narrationItemsFromSlots(bySlot: Partial<Record<OutfitSlot, BuilderItem>>) {
  return Object.values(bySlot)
    .filter((item): item is BuilderItem => Boolean(item))
    .map((item) => ({
      id: item.id,
      name: item.title,
      category: item.category,
      color_family: item.colorFamily ?? null,
      formality: item.formality ?? null,
    }));
}

function buildFullClosetDay(params: {
  closetItems: BuilderItem[];
  dayType: string;
  avgHighC?: number;
  avgLowC?: number;
  excludeItemIds?: ReadonlySet<string>;
  usedOuterwearTitles: string[];
  usedFootwearTitles: string[];
  jacketsCap: number;
  shoesCap: number;
}): {
  bySlot: Partial<Record<OutfitSlot, BuilderItem>>;
  usedOuterwearTitles: string[];
  usedFootwearTitles: string[];
} {
  const targetFormalityRank = TRIP_DAY_TYPE_FORMALITY_TARGET[params.dayType] ?? FORMALITY_RANK['Smart Casual'];
  const { includeLayering, includeOuterwear } = weatherGates(params.avgHighC ?? params.avgLowC ?? null);

  const built = buildDeterministicOutfit({
    closetItems: params.closetItems,
    targetFormalityRank,
    includeLayering,
    includeOuterwear,
    excludeItemIds: params.excludeItemIds,
  });

  const bySlot = { ...built.bySlot };
  let usedOuterwearTitles = params.usedOuterwearTitles;
  let usedFootwearTitles = params.usedFootwearTitles;

  if (bySlot.outerwear) {
    const capped = enforceClosetSlotCap({
      picked: bySlot.outerwear,
      usedTitles: usedOuterwearTitles,
      cap: params.jacketsCap,
      allowDrop: true,
      closetItems: params.closetItems,
    });
    bySlot.outerwear = capped.picked;
    usedOuterwearTitles = capped.usedTitles;
  }
  if (bySlot.footwear) {
    const capped = enforceClosetSlotCap({
      picked: bySlot.footwear,
      usedTitles: usedFootwearTitles,
      cap: params.shoesCap,
      allowDrop: false,
      closetItems: params.closetItems,
    });
    bySlot.footwear = capped.picked;
    usedFootwearTitles = capped.usedTitles;
  }

  return { bySlot, usedOuterwearTitles, usedFootwearTitles };
}

async function generateFullClosetTripOutfits(
  request: GenerateTripOutfitsRequest,
  profile: BuilderProfile,
  supabaseUserId: string,
): Promise<GenerateTripOutfitsResponse> {
  const styleGuideContext = await styleGuideService.retrieveGuidance({
    task: 'trip-generation',
    query: buildTripGenerationStyleGuideQuery(request, profile),
  });

  const { instructions, userContent, jsonSchema } = buildTripDayShapePrompt(request, profile, styleGuideContext?.promptContext);
  const shapeResult = await openAiClient.createStructuredResponse({
    schema: tripDayShapeResponseSchema,
    jsonSchema,
    instructions,
    userContent,
    supabaseUserId,
    feature: 'trip-generation',
  });

  const { itemsById } = await buildClosetIndex(supabaseUserId);
  const closetItems = [...itemsById.values()];

  const jacketsCap = Number(request.jacketsCount ?? '1');
  const shoesCap = parseShoesCap(request.shoesCount);
  let usedOuterwearTitles = request.usedOuterwear ?? [];
  let usedFootwearTitles = request.usedFootwear ?? [];

  const builtDays = shapeResult.days.map((shape) => {
    const built = buildFullClosetDay({
      closetItems,
      dayType: shape.dayType,
      avgHighC: request.avgHighC,
      avgLowC: request.avgLowC,
      usedOuterwearTitles,
      usedFootwearTitles,
      jacketsCap,
      shoesCap,
    });
    usedOuterwearTitles = built.usedOuterwearTitles;
    usedFootwearTitles = built.usedFootwearTitles;
    return { shape, bySlot: built.bySlot };
  });

  const narrationMap = await narrateTripDays({
    days: builtDays.map(({ shape, bySlot }, index) => ({
      index,
      dayType: shape.dayType,
      items: narrationItemsFromSlots(bySlot),
    })),
    destination: request.destination,
    climateLabel: request.climateLabel,
    avgHighC: request.avgHighC,
    supabaseUserId,
  });

  const days: TripOutfitDayDto[] = builtDays.map(({ shape, bySlot }, index) => {
    const narration = narrationMap.get(index);
    const dto = mapDaySlotsToDto(bySlot);
    return {
      id: `${request.tripId}-day-${shape.dayIndex}`,
      tripId: request.tripId,
      dayIndex: shape.dayIndex,
      date: shape.date,
      title: narration?.title ?? FALLBACK_TRIP_TITLE,
      dayType: shape.dayType,
      rationale: narration?.rationale ?? FALLBACK_TRIP_RATIONALE,
      contextTags: shape.contextTags,
      ...dto,
    };
  });

  return { tripId: request.tripId, days };
}

async function regenerateFullClosetDay(
  request: RegenerateTripDayRequest,
  supabaseUserId: string,
): Promise<TripOutfitDayDto> {
  const { itemsById } = await buildClosetIndex(supabaseUserId);
  const closetItems = [...itemsById.values()];

  // "Do NOT repeat the previous outfit" — we only have the previous day's
  // display text (not real ids), so exclude any real item whose title
  // matches one of those strings, guaranteeing a genuinely different pick
  // rather than trusting the weighted draw to avoid it by chance.
  const previousTitles = new Set(
    [...request.previousPieces, ...(request.previousShoes ? [request.previousShoes] : [])].map((t) => t.toLowerCase()),
  );
  const excludeItemIds = new Set(
    closetItems.filter((item) => previousTitles.has(item.title.toLowerCase())).map((item) => item.id),
  );

  const built = buildFullClosetDay({
    closetItems,
    dayType: request.dayType,
    avgHighC: request.avgHighC,
    avgLowC: request.avgLowC,
    excludeItemIds,
    usedOuterwearTitles: [],
    usedFootwearTitles: [],
    jacketsCap: Number.MAX_SAFE_INTEGER,
    shoesCap: Number.MAX_SAFE_INTEGER,
  });

  const narrationMap = await narrateTripDays({
    days: [{ index: 0, dayType: request.dayType, items: narrationItemsFromSlots(built.bySlot) }],
    destination: request.destination,
    climateLabel: request.climateLabel,
    avgHighC: request.avgHighC,
    supabaseUserId,
  });
  const narration = narrationMap.get(0);
  const dto = mapDaySlotsToDto(built.bySlot);

  return {
    id: `${request.tripId}-day-${request.dayIndex}-r${Date.now()}`,
    tripId: request.tripId,
    dayIndex: request.dayIndex,
    date: request.date,
    title: narration?.title ?? FALLBACK_TRIP_TITLE,
    dayType: request.dayType,
    rationale: narration?.rationale ?? FALLBACK_TRIP_RATIONALE,
    contextTags: [],
    ...dto,
  };
}

export const tripsService = {
  async generateTripOutfits(
    request: GenerateTripOutfitsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripOutfitsResponse> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    if (request.anchorMode === 'fullCloset') {
      return generateFullClosetTripOutfits(request, profile, supabaseUserId);
    }

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'trip-generation',
      query: buildTripGenerationStyleGuideQuery(request, profile),
    });

    const { instructions, userContent, jsonSchema } = buildTripOutfitsPrompt(request, profile, styleGuideContext?.promptContext);
    const anchorImageContent = await buildTripAnchorImageContent(request);

    const result = await openAiClient.createStructuredResponse({
      schema: tripOutfitsResponseSchema,
      jsonSchema,
      instructions,
      userContent: [...userContent, ...anchorImageContent],
      supabaseUserId,
      feature: 'trip-generation',
    });

    const jacketsCap = Number(request.jacketsCount ?? '1');
    let usedOuterwear = request.usedOuterwear ?? [];
    const shoesCap = parseShoesCap(request.shoesCount);
    let usedFootwear = request.usedFootwear ?? [];

    const days: TripOutfitDayDto[] = result.days.map((day) => {
      const { pieces, usedOuterwear: nextUsedOuterwear } = enforceOuterwearCap(day.pieces, usedOuterwear, jacketsCap);
      usedOuterwear = nextUsedOuterwear;
      const { shoes, usedFootwear: nextUsedFootwear } = enforceFootwearCap(day.shoes, usedFootwear, shoesCap);
      usedFootwear = nextUsedFootwear;

      return {
        ...day,
        pieces,
        shoes,
        id: `${request.tripId}-day-${day.dayIndex}`,
        tripId: request.tripId,
        bag: day.bag ?? null,
        accessories: day.accessories ?? [],
        closetItemIds: undefined,
      };
    });

    return { tripId: request.tripId, days };
  },

  async startDaySketchJob(params: {
    destination: string;
    dayTitle: string;
    climateLabel: string;
    pieces: string[];
    shoes: string;
    accessories: string[];
    profileId?: string;
    supabaseUserId: string;
  }): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void generateDaySketch(job.id, params);
    return job.id;
  },

  async regenerateDay(
    request: RegenerateTripDayRequest,
    supabaseUserId: string,
  ): Promise<TripOutfitDayDto> {
    if (request.isFullCloset) {
      return regenerateFullClosetDay(request, supabaseUserId);
    }

    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'trip-generation',
      query: buildTripRegenerationStyleGuideQuery(request, profile),
    });
    const { instructions, userContent, jsonSchema } = buildRegenerateDayPrompt(request, profile, styleGuideContext?.promptContext);

    const result = await openAiClient.createStructuredResponse({
      schema: regenerateDayResponseSchema,
      jsonSchema,
      instructions,
      userContent,
      supabaseUserId,
      feature: 'trip-generation',
    });

    return {
      ...result.day,
      id: `${request.tripId}-day-${request.dayIndex}-r${Date.now()}`,
      tripId: request.tripId,
      bag: result.day.bag ?? null,
      accessories: result.day.accessories ?? [],
      closetItemIds: undefined,
    };
  },

  async generateDayVariants(
    request: GenerateTripDayVariantsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripDayVariantsResponse> {
    const { itemsById } = await buildClosetIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];

    const validKeepIds = request.keepItemIds.filter((id) => itemsById.has(id));
    const validSwapIds = request.swapItemIds.filter((id) => itemsById.has(id));
    if (validSwapIds.length === 0) {
      throw new HttpError(422, 'INVALID_SWAP_ITEMS', 'Select 1 or 2 items from this day to swap.');
    }

    const targetFormalityRank = TRIP_DAY_TYPE_FORMALITY_TARGET[request.dayType] ?? FORMALITY_RANK['Smart Casual'];
    const excludeIds = new Set([...validKeepIds, ...validSwapIds]);

    // Each swap slot is constrained to the SAME garment group as the item
    // being replaced (pickVariantReplacements) — a shoe swap only ever offers
    // other shoes, never a different slot's item.
    const replacementLists = validSwapIds.map((swapId) =>
      pickVariantReplacements(itemsById.get(swapId)!, closetItems, targetFormalityRank, excludeIds, 5),
    );

    const variantCount = Math.min(5, ...replacementLists.map((list) => list.length));
    if (variantCount === 0) {
      throw new HttpError(502, 'TRIP_DAY_VARIANTS_INVALID', 'Your closet does not have another item in the same category to swap in.');
    }

    const variantItemIds = Array.from({ length: variantCount }, (_, index) => [
      ...validKeepIds,
      ...replacementLists.map((list) => list[index]!.id),
    ]);

    const narrationMap = await narrateTripDays({
      days: variantItemIds.map((itemIds, index) => ({
        index,
        dayType: request.dayType,
        items: itemIds.map((id) => {
          const item = itemsById.get(id)!;
          return { id: item.id, name: item.title, category: item.category, color_family: item.colorFamily ?? null, formality: item.formality ?? null };
        }),
      })),
      destination: request.destination,
      climateLabel: request.climateLabel,
      avgHighC: request.avgHighC,
      supabaseUserId,
    });

    const variants: TripOutfitDayDto[] = variantItemIds.map((itemIds, index) => {
      const narration = narrationMap.get(index);
      const dto = mapDaySlotsToDto(buildBySlotFromItemIds(itemIds, itemsById));
      return {
        id: `${request.tripId}-day-${request.dayIndex}-v${Date.now()}-${index}`,
        tripId: request.tripId,
        dayIndex: request.dayIndex,
        date: request.date,
        title: narration?.title ?? FALLBACK_TRIP_TITLE,
        dayType: request.dayType,
        rationale: narration?.rationale ?? FALLBACK_TRIP_RATIONALE,
        contextTags: [],
        ...dto,
      };
    });

    return { variants };
  },

  async updateDayAccessories(
    request: UpdateTripDayAccessoriesRequest,
    supabaseUserId: string,
  ): Promise<UpdateTripDayAccessoriesResponse> {
    const { itemsById } = await buildClosetIndex(supabaseUserId);
    const closetItems = [...itemsById.values()];

    const validItemIds = request.itemIds.filter((id) => itemsById.has(id));
    if (validItemIds.length < 2) {
      throw new HttpError(422, 'INVALID_BASE_OUTFIT', 'This day no longer matches your closet.');
    }

    const targetFormalityRank = TRIP_DAY_TYPE_FORMALITY_TARGET[request.dayType] ?? FORMALITY_RANK['Smart Casual'];
    const currentHatId = validItemIds.find((id) => CATEGORY_TO_GROUP[itemsById.get(id)!.category] === 'hat');
    const currentBagId = validItemIds.find((id) => CATEGORY_TO_GROUP[itemsById.get(id)!.category] === 'bag');

    let itemIds = validItemIds.filter((id) => id !== currentHatId || request.includeHat);
    itemIds = itemIds.filter((id) => id !== currentBagId || request.includeBag);

    if (request.includeHat && !currentHatId) {
      const hat = pickAccessory('hat', closetItems, targetFormalityRank, new Set(itemIds));
      if (hat) itemIds.push(hat.id);
    }
    if (request.includeBag && !currentBagId) {
      const bag = pickAccessory('bag', closetItems, targetFormalityRank, new Set(itemIds));
      if (bag) itemIds.push(bag.id);
    }

    return mapDaySlotsToDto(buildBySlotFromItemIds(itemIds, itemsById));
  },

  async getDaySketchStatus(jobId: string) {
    const job = await closetRepository.getSketchJob(jobId);
    if (!job) return { sketchStatus: 'failed' as const, sketchImageUrl: null };

    if (job.status === 'ready' && job.sketchStorageKey) {
      const url = `${env.STORAGE_PUBLIC_BASE_URL}/media/${job.sketchStorageKey}`;
      return { sketchStatus: 'ready' as const, sketchImageUrl: url };
    }

    return {
      sketchStatus: (job.status === 'pending' ? 'pending' : 'failed') as 'pending' | 'failed',
      sketchImageUrl: null,
    };
  },
};

type StyleGuideProfile = {
  gender?: string | null;
  stylePreference?: string | null;
  fitPreference?: string | null;
} | null;

function formatStyleGuideProfileQuery(profile: StyleGuideProfile) {
  return [
    profile?.gender === 'woman' ? 'womenswear travel styling guidance' : 'menswear travel styling guidance',
    profile?.stylePreference ? `user style preference: ${profile.stylePreference}` : null,
    profile?.fitPreference ? `user fit preference: ${profile.fitPreference}` : null,
  ];
}

function buildTripGenerationStyleGuideQuery(
  request: GenerateTripOutfitsRequest,
  profile: StyleGuideProfile,
) {
  return [
    ...formatStyleGuideProfileQuery(profile),
    `destination: ${request.destination}, ${request.country}`,
    `purpose: ${request.purposes.join(', ') || 'Leisure'}`,
    `style vibe: ${request.styleVibe}`,
    `climate: ${request.climateLabel}`,
    request.dressSeason ? `season: ${request.dressSeason}` : null,
    request.packingTag ? `packing weather tag: ${request.packingTag}` : null,
    request.activities ? `activities: ${request.activities}` : null,
    request.dressCode ? `dress code: ${request.dressCode}` : null,
    request.anchors?.length
      ? `anchor pieces: ${request.anchors.map((anchor) => `${anchor.category} ${anchor.label}`).join('; ')}`
      : null,
  ].filter(Boolean).join(' | ');
}

function buildTripRegenerationStyleGuideQuery(
  request: Pick<RegenerateTripDayRequest, 'destination' | 'country' | 'dayType' | 'styleVibe' | 'climateLabel' | 'activities' | 'dressCode' | 'purposes'>,
  profile: StyleGuideProfile,
) {
  return [
    ...formatStyleGuideProfileQuery(profile),
    `destination: ${request.destination}, ${request.country}`,
    `day type: ${request.dayType}`,
    `style vibe: ${request.styleVibe}`,
    `climate: ${request.climateLabel}`,
    request.activities ? `activities: ${request.activities}` : null,
    request.dressCode ? `dress code: ${request.dressCode}` : null,
    request.purposes.length ? `purpose: ${request.purposes.join(', ')}` : null,
  ].filter(Boolean).join(' | ');
}

async function buildTripAnchorImageContent(request: GenerateTripOutfitsRequest): Promise<InputContent[]> {
  const anchors = request.anchors ?? [];
  if (anchors.length === 0) return [];

  const content: InputContent[] = [];

  for (const anchor of anchors) {
    if (anchor.uploadedImageId) {
      const uploadedImage = await uploadsRepository.findById(anchor.uploadedImageId);
      if (uploadedImage) {
        content.push({ type: 'input_text', text: `Anchor image reference: [${anchor.category}] ${anchor.label}` });
        content.push(await buildModelImageInput(uploadedImage));
        continue;
      }
    }

    if (anchor.imageUrl) {
      const imageInput = await resolveImageUrlForAI(anchor.imageUrl);
      if (imageInput) {
        content.push({ type: 'input_text', text: `Anchor image reference: [${anchor.category}] ${anchor.label}` });
        content.push(imageInput);
      }
    }
  }

  return content;
}

// ── Background sketch generation ──────────────────────────────────────────────

async function generateDaySketch(
  jobId: string,
  params: {
    destination: string;
    dayTitle: string;
    climateLabel: string;
    pieces: string[];
    shoes: string;
    accessories: string[];
    profileId?: string;
    supabaseUserId: string;
  },
): Promise<void> {
  try {
    const profile = params.profileId
      ? await profileRepository.findById(params.profileId)
      : await profileRepository.findByUserId(params.supabaseUserId);

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

    const prompt = buildTripDaySketchPrompt({
      destination: params.destination,
      dayTitle: params.dayTitle,
      climateLabel: params.climateLabel,
      pieces: params.pieces,
      shoes: params.shoes,
      accessories: params.accessories,
      subjectBrief,
    });

    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: (env.OPENAI_OUTFIT_SKETCH_QUALITY as 'low' | 'medium' | 'high' | 'auto') ?? 'low',
      outputFormat: 'jpeg',
      supabaseUserId: params.supabaseUserId,
      feature: 'trip-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
      logContext: { jobId },
    });

    const storageKey = `closet-sketch/trip-${jobId}.jpg`;
    const imageBuffer = generatedImage.data;

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchStorageKey: storageKey,
      sketchMimeType: 'image/jpeg',
      sketchImageData: imageBuffer,
    });

    logger.info({ jobId }, '[trip-sketch] Sketch generated successfully');
  } catch (err) {
    const { code, message } = describeError(err);
    logger.error({ jobId, errorCode: code, err }, '[trip-sketch] Sketch generation failed');
    await closetRepository
      .updateSketchJob(jobId, { status: 'failed', sketchErrorCode: code, sketchErrorMessage: message })
      .catch(() => {});
  }
}
