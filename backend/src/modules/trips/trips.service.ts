import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import {
  buildTripOutfitsPrompt,
  buildTripDaySketchPrompt,
  buildRegenerateDayPrompt,
  buildTripDayShapePrompt,
  buildTripDayChoiceSystemPrompt,
  buildTripDayChoiceUserPrompt,
  buildTripDayVariantsChoiceUserPrompt,
} from '../../ai/prompts/trips.prompts.js';
import type { ClosetOutfitIndexItem, ClosetOutfitSlotShortlists } from '../../ai/prompts/closet-outfits.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError, HttpError } from '../../lib/http-error.js';
import { profileRepository } from '../profile/profile.repository.js';
import { buildClosetIndex } from '../closet/closet-index.js';
import { closetRepository } from '../closet/closet.repository.js';
import { buildDeterministicOutfit, buildOutfitSlotShortlists, buildVariantCandidates, fillMissingRequiredSlots, normalizeSuitDualRole } from '../closet/closet-outfit-builder.js';
import { CATEGORY_TO_GROUP, FORMALITY_RANK, GROUP_TO_SLOTS, TRIP_DAY_TYPE_FORMALITY_TARGET, type OutfitSlot } from '../closet/closet-taxonomy.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import {
  regenerateDayResponseSchema,
  tripOutfitsResponseSchema,
  tripDayShapeResponseSchema,
  tripDayChoiceResponseSchema,
  buildTripDayChoiceJsonSchema,
  buildTripDayVariantsChoiceJsonSchema,
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
// real items (narrowShortlistForCap below) rather than by keyword-matching text.
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

// ── fullCloset helpers ────────────────────────────────────────────────────────

type BuilderItem = Awaited<ReturnType<typeof closetRepository.getItems>>[number];
type BuilderProfile = Awaited<ReturnType<typeof profileRepository.findByUserId>>;

function weatherGates(temperatureC: number | null): { includeLayering: boolean; includeOuterwear: boolean } {
  if (temperatureC == null) return { includeLayering: true, includeOuterwear: true };
  if (temperatureC >= 24) return { includeLayering: false, includeOuterwear: false };
  if (temperatureC >= 18) return { includeLayering: false, includeOuterwear: true };
  return { includeLayering: true, includeOuterwear: true };
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

// A suit occupies both bySlot.bottoms and bySlot.outerwear as the SAME item
// (normalizeSuitDualRole) — dedupe by id so it's listed once, not twice.
function dedupeById(items: (BuilderItem | undefined)[]): BuilderItem[] {
  const seen = new Set<string>();
  const result: BuilderItem[] = [];
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function mapDaySlotsToDto(bySlot: Partial<Record<OutfitSlot, BuilderItem>>): {
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  closetItemIds: string[];
} {
  const pieces = dedupeById([bySlot.bottoms, bySlot.tops, bySlot.layering, bySlot.outerwear]).map((item) => item.title);
  const accessories = dedupeById([bySlot.watch, bySlot.sunglasses, bySlot.hat]).map((item) => item.title);
  const closetItemIds = dedupeById(Object.values(bySlot)).map((item) => item.id);

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
// (from a swap/toggle request) rather than a fresh choice result that
// already carries slots.
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
  // A suit in a flat id list only ever lands in 'bottoms' (GROUP_TO_SLOTS
  // takes the first slot) — this promotes it to also fill 'outerwear'.
  normalizeSuitDualRole(bySlot);
  return bySlot;
}

// Reuses the shared deterministic builder to pick a single hat/bag by
// restricting its candidate pool to just that garment group — a single,
// low-stakes accessory addition doesn't warrant its own LLM round-trip the
// way full day assembly does.
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

// Narrows a slot's shortlist once its cross-day cap is reached — replacing
// free choice with "must reuse an already-used item" (or, for outerwear,
// omitting the slot entirely if the cap is 0) BEFORE the model ever sees the
// shortlist, rather than overriding an already-made pick after the fact.
//
// Formality-aware: the cap counts distinct PAIRS, but a trip with both
// casual and business days needs pairs across formality bands, not N
// interchangeable pairs. If the early (often lower-formality) days already
// "spent" the cap on pairs that don't suit THIS day's formality, force-
// reusing one of them would lock a business day into a sneaker forever —
// so only force reuse when an already-used item is actually a reasonable
// match for this day; otherwise leave the shortlist open for a fresh pick
// even though the raw pair-count is nominally at cap.
function narrowShortlistForCap(
  shortlists: Partial<Record<OutfitSlot, BuilderItem[]>>,
  slot: 'outerwear' | 'footwear',
  usedTitles: string[],
  cap: number,
  allowDrop: boolean,
  closetItems: BuilderItem[],
  targetFormalityRank: number,
): void {
  if (!shortlists[slot]) return;

  if (allowDrop && cap <= 0) {
    delete shortlists[slot];
    return;
  }

  const effectiveCap = allowDrop ? cap : Math.max(1, cap);
  if (usedTitles.length < effectiveCap) return; // room for a new item — leave the shortlist as-is

  const usedItems = closetItems.filter((item) => usedTitles.some((title) => title.toLowerCase() === item.title.toLowerCase()));
  const usedItemsInBand = usedItems.filter((item) => {
    const rank = item.formality ? FORMALITY_RANK[item.formality] ?? 2 : 2;
    return Math.abs(rank - targetFormalityRank) <= 1;
  });

  if (usedItemsInBand.length > 0) {
    shortlists[slot] = usedItemsInBand;
  } else if (usedItems.length === 0 && allowDrop) {
    delete shortlists[slot];
  }
  // else: cap is "full" but nothing already used fits this day's formality —
  // leave the shortlist as originally built so a genuinely new, formality-
  // appropriate pair can still be introduced.
}

/**
 * Closet-sourced "definitely bring" anchors should actually get featured on
 * the trip, not silently ignored once fullCloset mode is on — picks the
 * unused anchor whose own formality is closest to this day's target, but
 * only on days formal enough to plausibly want a dedicated piece (never
 * forces a business suit onto a beach day just because it's on the list).
 */
function pickAnchorForDay(params: {
  targetFormalityRank: number;
  closetAnchorItems: BuilderItem[];
  usedAnchorItemIds: ReadonlySet<string>;
}): BuilderItem | null {
  if (params.targetFormalityRank < FORMALITY_RANK['Refined Casual']) return null;

  const unused = params.closetAnchorItems.filter((item) => !params.usedAnchorItemIds.has(item.id));
  if (unused.length === 0) return null;

  const sorted = [...unused].sort((a, b) => {
    const rankA = a.formality ? FORMALITY_RANK[a.formality] ?? 2 : 2;
    const rankB = b.formality ? FORMALITY_RANK[b.formality] ?? 2 : 2;
    return Math.abs(rankA - params.targetFormalityRank) - Math.abs(rankB - params.targetFormalityRank);
  });
  return sorted[0]!;
}

function updateUsedTitles(bySlot: Partial<Record<OutfitSlot, BuilderItem>>, slot: 'outerwear' | 'footwear', usedTitles: string[]): string[] {
  const picked = bySlot[slot];
  if (!picked) return usedTitles;
  if (usedTitles.some((title) => title.toLowerCase() === picked.title.toLowerCase())) return usedTitles;
  return [...usedTitles, picked.title];
}

/**
 * Chooses + narrates ONE day via a single LLM call over its formality-
 * filtered shortlists — mirrors closet-outfits.service.ts's generateOutfits,
 * scoped to a single day so outerwear/footwear cap-narrowing can be threaded
 * day-by-day even across separate progressive generation requests (the real
 * usage pattern — see useTripResultsData.ts's per-day loop).
 */
async function chooseFullClosetDay(params: {
  index: number;
  closetItems: BuilderItem[];
  dayType: string;
  destination: string;
  climateLabel?: string;
  avgHighC?: number;
  avgLowC?: number;
  excludeItemIds?: ReadonlySet<string>;
  usedOuterwearTitles: string[];
  usedFootwearTitles: string[];
  jacketsCap: number;
  shoesCap: number;
  /** A closet-sourced "definitely bring" anchor forced into this day — see pickAnchorForDay. */
  pinnedItem?: BuilderItem | null;
  supabaseUserId: string;
}): Promise<{
  bySlot: Partial<Record<OutfitSlot, BuilderItem>>;
  title: string;
  rationale: string;
  usedOuterwearTitles: string[];
  usedFootwearTitles: string[];
}> {
  const targetFormalityRank = TRIP_DAY_TYPE_FORMALITY_TARGET[params.dayType] ?? FORMALITY_RANK['Smart Casual'];
  const { includeLayering, includeOuterwear } = weatherGates(params.avgHighC ?? params.avgLowC ?? null);

  const shortlists = buildOutfitSlotShortlists({
    closetItems: params.closetItems,
    targetFormalityRank,
    includeLayering,
    includeOuterwear,
    excludeItemIds: params.excludeItemIds,
  });

  narrowShortlistForCap(shortlists, 'outerwear', params.usedOuterwearTitles, params.jacketsCap, true, params.closetItems, targetFormalityRank);
  narrowShortlistForCap(shortlists, 'footwear', params.usedFootwearTitles, params.shoesCap, false, params.closetItems, targetFormalityRank);

  // Force the pinned "definitely bring" anchor into whichever slot(s) its
  // category fills (both bottoms+outerwear for a Suit) — applied AFTER cap
  // narrowing so a pinned anchor always wins over a cap-driven reuse, and
  // narrowing that slot's shortlist to just this one id guarantees it gets
  // used rather than hoping the model notices it among everything offered.
  if (params.pinnedItem) {
    const pinnedGroup = CATEGORY_TO_GROUP[params.pinnedItem.category];
    for (const slot of pinnedGroup ? GROUP_TO_SLOTS[pinnedGroup] ?? [] : []) {
      shortlists[slot] = [params.pinnedItem];
    }
  }

  const slots = (Object.keys(shortlists) as OutfitSlot[]).filter((slot) => (shortlists[slot]?.length ?? 0) > 0);

  if (slots.length === 0) {
    // Even with every shortlist empty (unexpected, but not impossible after
    // cap-narrowing deletes a slot entirely), still try to fill the always-
    // required categories directly from the raw closet — never return a
    // fully-empty day when the closet has anything at all to offer.
    const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = {};
    const requiredSlots: OutfitSlot[] = ['footwear', 'bottoms', 'tops'];
    if (includeLayering) requiredSlots.push('layering');
    if (includeOuterwear) requiredSlots.push('outerwear');
    fillMissingRequiredSlots({ bySlot, closetItems: params.closetItems, requiredSlots });
    normalizeSuitDualRole(bySlot);
    return {
      bySlot,
      title: FALLBACK_TRIP_TITLE,
      rationale: FALLBACK_TRIP_RATIONALE,
      usedOuterwearTitles: updateUsedTitles(bySlot, 'outerwear', params.usedOuterwearTitles),
      usedFootwearTitles: updateUsedTitles(bySlot, 'footwear', params.usedFootwearTitles),
    };
  }

  const shortlistsForPrompt: ClosetOutfitSlotShortlists = {};
  const idsBySlot: Record<string, string[]> = {};
  for (const slot of slots) {
    const items = shortlists[slot]!;
    shortlistsForPrompt[slot] = items.map(toIndexItem);
    idsBySlot[slot] = items.map((item) => item.id);
  }

  const userPrompt = buildTripDayChoiceUserPrompt({
    days: [{ index: params.index, dayType: params.dayType, shortlists: shortlistsForPrompt }],
    destination: params.destination,
    climateLabel: params.climateLabel,
    avgHighC: params.avgHighC,
  });

  let chosen: { title: string; rationale: string; chosenIds: Record<string, string> } | null = null;
  try {
    const aiResult = await openAiClient.createStructuredResponse({
      schema: tripDayChoiceResponseSchema,
      jsonSchema: buildTripDayChoiceJsonSchema({ slots, idsBySlot, count: 1 }),
      instructions: buildTripDayChoiceSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId: params.supabaseUserId,
      feature: 'trip-generation',
    });
    const dayResult = aiResult.days.find((day) => day.index === params.index) ?? aiResult.days[0];
    if (dayResult) {
      const validIdSets = new Map(Object.entries(idsBySlot).map(([slot, ids]) => [slot, new Set(ids)]));
      const chosenEntries = Object.entries(dayResult.chosenIds);
      const valid = chosenEntries.length > 0 && chosenEntries.every(([slot, id]) => validIdSets.get(slot)?.has(id));
      if (valid) {
        chosen = { title: dayResult.title, rationale: dayResult.rationale, chosenIds: dayResult.chosenIds };
      }
    }
  } catch (error) {
    const { code } = describeError(error);
    logger.warn({ errorCode: code, error }, 'Trip day choice failed — falling back to a safe default pick');
  }

  const itemsById = new Map(params.closetItems.map((item) => [item.id, item]));
  const bySlot: Partial<Record<OutfitSlot, BuilderItem>> = chosen
    ? (Object.fromEntries(Object.entries(chosen.chosenIds).map(([slot, id]) => [slot, itemsById.get(id)!])) as Partial<Record<OutfitSlot, BuilderItem>>)
    : (Object.fromEntries(slots.map((slot) => [slot, shortlists[slot]![0]!])) as Partial<Record<OutfitSlot, BuilderItem>>);
  normalizeSuitDualRole(bySlot);

  // Hard guarantee, no exceptions: footwear/bottoms/tops always, plus
  // layering/outerwear whenever the weather calls for them — never leave a
  // required category silently unfilled, whatever upstream reason (empty
  // shortlist, model omission, validation fallback) caused it.
  const requiredSlots: OutfitSlot[] = ['footwear', 'bottoms', 'tops'];
  if (includeLayering) requiredSlots.push('layering');
  if (includeOuterwear) requiredSlots.push('outerwear');
  fillMissingRequiredSlots({ bySlot, closetItems: params.closetItems, requiredSlots });
  normalizeSuitDualRole(bySlot);

  return {
    bySlot,
    title: chosen?.title ?? FALLBACK_TRIP_TITLE,
    rationale: chosen?.rationale ?? FALLBACK_TRIP_RATIONALE,
    usedOuterwearTitles: updateUsedTitles(bySlot, 'outerwear', params.usedOuterwearTitles),
    usedFootwearTitles: updateUsedTitles(bySlot, 'footwear', params.usedFootwearTitles),
  };
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

  // Closet-sourced "definitely bring" anchors ("Add from closet" chips on the
  // trip form) — these must actually get scheduled somewhere across the
  // trip, not silently dropped once fullCloset mode is on. usedAnchorItemIds
  // is threaded the same way as the outerwear/footwear caps, since real
  // generation is one day per HTTP request (progressive), not one batched call.
  const closetAnchorItems = (request.anchors ?? [])
    .filter((anchor) => anchor.source === 'closet' && anchor.closetItemId && itemsById.has(anchor.closetItemId))
    .map((anchor) => itemsById.get(anchor.closetItemId!)!);
  const usedAnchorItemIds = new Set(request.usedAnchorItemIds ?? []);

  // Sequential, not parallel — the outerwear/footwear cap must be threaded
  // day-by-day in order (each day narrows or updates the running "used" list
  // the next day reads).
  const days: TripOutfitDayDto[] = [];
  for (const shape of shapeResult.days) {
    const targetFormalityRank = TRIP_DAY_TYPE_FORMALITY_TARGET[shape.dayType] ?? FORMALITY_RANK['Smart Casual'];
    const pinnedItem = pickAnchorForDay({ targetFormalityRank, closetAnchorItems, usedAnchorItemIds });
    if (pinnedItem) usedAnchorItemIds.add(pinnedItem.id);

    const chosen = await chooseFullClosetDay({
      index: shape.dayIndex,
      closetItems,
      dayType: shape.dayType,
      destination: request.destination,
      climateLabel: request.climateLabel,
      avgHighC: request.avgHighC,
      avgLowC: request.avgLowC,
      usedOuterwearTitles,
      usedFootwearTitles,
      jacketsCap,
      shoesCap,
      pinnedItem,
      supabaseUserId,
    });
    usedOuterwearTitles = chosen.usedOuterwearTitles;
    usedFootwearTitles = chosen.usedFootwearTitles;

    days.push({
      id: `${request.tripId}-day-${shape.dayIndex}`,
      tripId: request.tripId,
      dayIndex: shape.dayIndex,
      date: shape.date,
      title: chosen.title,
      dayType: shape.dayType,
      rationale: chosen.rationale,
      contextTags: shape.contextTags,
      ...mapDaySlotsToDto(chosen.bySlot),
    });
  }

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
  // matches one of those strings, guaranteeing a genuinely different
  // shortlist rather than trusting the model to avoid it by chance.
  const previousTitles = new Set(
    [...request.previousPieces, ...(request.previousShoes ? [request.previousShoes] : [])].map((t) => t.toLowerCase()),
  );
  const excludeItemIds = new Set(
    closetItems.filter((item) => previousTitles.has(item.title.toLowerCase())).map((item) => item.id),
  );

  const chosen = await chooseFullClosetDay({
    index: 0,
    closetItems,
    dayType: request.dayType,
    destination: request.destination,
    climateLabel: request.climateLabel,
    avgHighC: request.avgHighC,
    avgLowC: request.avgLowC,
    excludeItemIds,
    usedOuterwearTitles: [],
    usedFootwearTitles: [],
    jacketsCap: Number.MAX_SAFE_INTEGER,
    shoesCap: Number.MAX_SAFE_INTEGER,
    supabaseUserId,
  });

  return {
    id: `${request.tripId}-day-${request.dayIndex}-r${Date.now()}`,
    tripId: request.tripId,
    dayIndex: request.dayIndex,
    date: request.date,
    title: chosen.title,
    dayType: request.dayType,
    rationale: chosen.rationale,
    contextTags: [],
    ...mapDaySlotsToDto(chosen.bySlot),
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
    // being replaced — a shoe swap only ever offers other shoes. The
    // shortlist is generous so the model can reason about which real
    // replacement actually coordinates with the kept pieces.
    const slots: string[] = [];
    const idsBySlot: Record<string, string[]> = {};
    const swapShortlists: ClosetOutfitSlotShortlists = {};

    for (const swapId of validSwapIds) {
      const originalItem = itemsById.get(swapId)!;
      const group = CATEGORY_TO_GROUP[originalItem.category];
      const slot = group ? GROUP_TO_SLOTS[group]?.[0] : undefined;
      if (!slot) continue;
      const candidates = buildVariantCandidates(originalItem, closetItems, targetFormalityRank, excludeIds);
      if (candidates.length === 0) continue;
      slots.push(slot);
      idsBySlot[slot] = candidates.map((item) => item.id);
      swapShortlists[slot] = candidates.map(toIndexItem);
    }

    if (slots.length === 0) {
      throw new HttpError(502, 'TRIP_DAY_VARIANTS_INVALID', 'Your closet does not have another item in the same category to swap in.');
    }

    const keepItems = validKeepIds.map((id) => toIndexItem(itemsById.get(id)!));

    const userPrompt = buildTripDayVariantsChoiceUserPrompt({
      dayIndex: request.dayIndex,
      dayType: request.dayType,
      keepItems,
      swapShortlists,
      destination: request.destination,
      climateLabel: request.climateLabel,
      avgHighC: request.avgHighC,
    });

    const aiResult = await openAiClient.createStructuredResponse({
      schema: tripDayChoiceResponseSchema,
      jsonSchema: buildTripDayVariantsChoiceJsonSchema({ slots, idsBySlot, maxCount: 5 }),
      instructions: buildTripDayChoiceSystemPrompt(),
      userContent: [{ type: 'input_text' as const, text: userPrompt }],
      supabaseUserId,
      feature: 'trip-generation',
    });

    const validIdSets = new Map(Object.entries(idsBySlot).map(([slot, ids]) => [slot, new Set(ids)]));
    const seenKeys = new Set<string>();
    const variants: TripOutfitDayDto[] = [];

    for (const day of aiResult.days) {
      const chosenEntries = Object.entries(day.chosenIds);
      const valid = chosenEntries.length > 0 && chosenEntries.every(([slot, id]) => validIdSets.get(slot)?.has(id));
      if (!valid) continue;

      const swapIds = chosenEntries.map(([, id]) => id);
      if (new Set(swapIds).size !== swapIds.length) continue;

      const itemIds = [...validKeepIds, ...swapIds];
      const key = [...itemIds].sort().join('|');
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      variants.push({
        id: `${request.tripId}-day-${request.dayIndex}-v${Date.now()}-${variants.length}`,
        tripId: request.tripId,
        dayIndex: request.dayIndex,
        date: request.date,
        title: day.title,
        dayType: request.dayType,
        rationale: day.rationale,
        contextTags: [],
        ...mapDaySlotsToDto(buildBySlotFromItemIds(itemIds, itemsById)),
      });
    }

    if (variants.length === 0) {
      throw new HttpError(502, 'TRIP_DAY_VARIANTS_INVALID', 'Could not generate variants for that day. Please try again.');
    }

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
