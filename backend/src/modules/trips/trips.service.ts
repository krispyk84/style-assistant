import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput, resolveImageUrlForAI } from '../../ai/image-input.js';
import { buildTripOutfitsPrompt, buildTripDaySketchPrompt, buildRegenerateDayPrompt, buildDayVariantsPrompt } from '../../ai/prompts/trips.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { describeError, HttpError } from '../../lib/http-error.js';
import { profileRepository } from '../profile/profile.repository.js';
import { buildClosetIndex } from '../closet/closet-index.js';
import { closetRepository } from '../closet/closet.repository.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import { regenerateDayResponseSchema, tripDayVariantsResponseSchema, tripOutfitsResponseSchema } from './trips.schemas.js';
import type { GenerateTripDayVariantsRequest, GenerateTripDayVariantsResponse, GenerateTripOutfitsRequest, GenerateTripOutfitsResponse, RegenerateTripDayRequest, TripOutfitDayDto } from '../../contracts/trips.contracts.js';
import type { InputContent } from '../../ai/openai-request-builder.js';

// Mirrors lib/outfit-piece-display.ts's CATEGORY_KEYWORDS['Outerwear'] on the
// frontend — kept as a separate constant here since that file isn't shared
// with the backend. Used to enforce the outerwear cap programmatically:
// pure prompt instructions weren't reliable enough across ~8 separate,
// stateless per-day generation calls (each day is its own API request with
// no real memory of prior turns beyond a text summary) — the model kept
// inventing a new jacket per day despite being told not to.
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

export const tripsService = {
  async generateTripOutfits(
    request: GenerateTripOutfitsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripOutfitsResponse> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'trip-generation',
      query: buildTripGenerationStyleGuideQuery(request, profile),
    });

    // "From My Closet" hands the model the full wardrobe index and requires
    // every day to be built from real ids — mirrors closet-outfits.service.ts's
    // "never let the model invent inventory" pattern.
    const isFullCloset = request.anchorMode === 'fullCloset';
    const closetIndex = isFullCloset ? await buildClosetIndex(supabaseUserId) : null;

    const { instructions, userContent, jsonSchema } = buildTripOutfitsPrompt(
      request,
      profile,
      styleGuideContext?.promptContext,
      closetIndex?.index,
    );
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
        // Never trust the model's ids at face value — drop any id that isn't
        // actually in the wardrobe index rather than pretending the user owns
        // an item that doesn't exist.
        closetItemIds: closetIndex
          ? (day.closetItemIds ?? []).filter((id) => closetIndex.itemsById.has(id))
          : undefined,
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
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'trip-generation',
      query: buildTripRegenerationStyleGuideQuery(request, profile),
    });
    const closetIndex = request.isFullCloset ? await buildClosetIndex(supabaseUserId) : null;
    const { instructions, userContent, jsonSchema } = buildRegenerateDayPrompt(
      request,
      profile,
      styleGuideContext?.promptContext,
      closetIndex?.index,
    );

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
      closetItemIds: closetIndex
        ? (result.day.closetItemIds ?? []).filter((id) => closetIndex.itemsById.has(id))
        : undefined,
    };
  },

  async generateDayVariants(
    request: GenerateTripDayVariantsRequest,
    supabaseUserId: string,
  ): Promise<GenerateTripDayVariantsResponse> {
    const profile = request.profileId
      ? await profileRepository.findById(request.profileId)
      : await profileRepository.findByUserId(supabaseUserId);

    const closetIndex = await buildClosetIndex(supabaseUserId);

    const validKeepIds = request.keepItemIds.filter((id) => closetIndex.itemsById.has(id));
    const validSwapIds = request.swapItemIds.filter((id) => closetIndex.itemsById.has(id));
    if (validSwapIds.length === 0) {
      throw new HttpError(422, 'INVALID_SWAP_ITEMS', 'Select 1 or 2 items from this day to swap.');
    }

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'trip-generation',
      query: buildTripRegenerationStyleGuideQuery(request, profile),
    });
    const { instructions, userContent, jsonSchema } = buildDayVariantsPrompt(
      { ...request, keepItemIds: validKeepIds, swapItemIds: validSwapIds },
      profile,
      closetIndex.index,
      styleGuideContext?.promptContext,
    );

    const result = await openAiClient.createStructuredResponse({
      schema: tripDayVariantsResponseSchema,
      jsonSchema,
      instructions,
      userContent,
      supabaseUserId,
      feature: 'trip-generation',
    });

    const swapIdSet = new Set(validSwapIds);
    const keepIdSet = new Set(validKeepIds);

    const variants: TripOutfitDayDto[] = result.variants
      .map((variant, index) => ({
        ...variant,
        id: `${request.tripId}-day-${request.dayIndex}-v${Date.now()}-${index}`,
        tripId: request.tripId,
        bag: variant.bag ?? null,
        accessories: variant.accessories ?? [],
        closetItemIds: (variant.closetItemIds ?? []).filter((id) => closetIndex.itemsById.has(id)),
      }))
      // Reject any variant that isn't a genuine swap: either it still carries
      // one of the original swapped-out ids (nothing actually changed), or it
      // never introduces a real replacement id at all (the model dropped the
      // swap slot from closetItemIds entirely while still narrating it in
      // pieces/rationale) — both produce a card indistinguishable from what
      // the user already has.
      .filter((variant) => {
        const ids = variant.closetItemIds ?? [];
        const stillHasSwappedOutItem = ids.some((id) => swapIdSet.has(id));
        const hasGenuineReplacement = ids.some((id) => !keepIdSet.has(id) && !swapIdSet.has(id));
        return !stillHasSwappedOutItem && hasGenuineReplacement;
      });

    if (variants.length === 0) {
      throw new HttpError(502, 'TRIP_DAY_VARIANTS_INVALID', 'Could not generate variants for that day. Please try again.');
    }

    return { variants };
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
