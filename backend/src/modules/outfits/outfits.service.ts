import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError } from '../../lib/http-error.js';
import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildAnchorImageContent } from '../../ai/image-input.js';
import type { SubjectRenderingInput } from '../../ai/body-type-severity.js';
import {
  buildSingleTierRegenerationJsonSchema,
  singleTierRegenerationSchema,
  buildTieredOutfitGenerationJsonSchema,
  tieredOutfitGenerationSchema,
} from './outfits.schemas.js';
import { buildClosetIndex } from '../closet/closet-index.js';
import { buildGenerateOutfitsInstructions, buildGenerateOutfitsUserPrompt, buildRegenerateTierInstructions, buildRegenerateTierUserPrompt } from '../../ai/prompts/outfits.prompts.js';
import {
  buildOutfitGenerationStyleGuideQuery,
  buildOutfitRegenerationStyleGuideQuery,
  getCanonicalAnchorDescription,
  getNormalizedAnchorItems,
} from './outfits-prompt-builders.js';
import { buildStableSketchUrl, mapOutfitRecommendation } from './outfits-response-mapper.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { outfitsRepository } from './outfits.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import { tierSketchService } from './tier-sketch.service.js';
import { seasonalTrendsService } from '../seasonal-trends/seasonal-trends.service.js';
import { trendFeedbackService } from '../seasonal-trends/trend-feedback.service.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';

const CANONICAL_TIERS: OutfitTierSlug[] = ['business', 'smart-casual', 'casual'];

// Outfit sketches are stored as DB blobs (TierResult.sketchImageData), so
// unbounded history growth is unbounded Postgres storage growth. Keep the
// most recent N generations per user; anything older gets pruned, except a
// request that's currently favourited or assigned to a week day — those stay
// forever regardless of age, since Favourites/Week always resolve their
// sketch image live from this same TierResult row by requestId+tier.
export const HISTORY_RETENTION_LIMIT = 50;


async function findProfile(supabaseUserId: string, profileId?: string) {
  if (profileId) {
    return profileRepository.findById(profileId);
  }
  return profileRepository.findByUserId(supabaseUserId);
}

type ProfileLike = Awaited<ReturnType<typeof findProfile>>;

function fashionGenderForProfile(profile: ProfileLike): FashionGender {
  return profile?.gender === 'woman' ? 'womenswear' : 'menswear';
}

async function loadSeasonalTrends(profile: ProfileLike, hemisphere: Hemisphere | undefined, supabaseUserId: string) {
  if (!hemisphere) return null;
  const fashionGender = fashionGenderForProfile(profile);
  const [result, feedbackMap] = await Promise.all([
    seasonalTrendsService.getCurrentTrendProfile(fashionGender, hemisphere),
    trendFeedbackService.getFeedbackMap(supabaseUserId, fashionGender),
  ]);
  if (!result) return null;
  return { ...result, feedbackMap };
}

function profileToSubject(profile: ProfileLike): SubjectRenderingInput {
  return {
    gender: profile?.gender ?? null,
    bodyType: profile?.bodyType ?? null,
    fitTendency: profile?.fitTendency ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    weightDistribution: profile?.weightDistribution ?? null,
    skinTone: profile?.skinTone ?? null,
  };
}

export const outfitsService = {
  async getOutfitResult(requestId: string) {
    const existing = await outfitsRepository.findGeneratedOutfit(requestId);

    if (!existing) {
      throw new HttpError(404, 'OUTFIT_REQUEST_NOT_FOUND', 'No outfit request exists for the provided id.');
    }

    return {
      ...existing,
      recommendations: existing.recommendations.map((recommendation) => ({
        ...recommendation,
        sketchImageUrl:
          recommendation.sketchStatus === 'ready'
            ? buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, requestId, recommendation.tier, `${existing.generatedAt}-${recommendation.variantIndex}`)
            : null,
      })),
    };
  },

  async getTierSketch(requestId: string, tier: OutfitTierSlug) {
    const sketch = await outfitsRepository.findTierSketch(requestId, tier);

    if (!sketch || sketch.sketchStatus !== 'ready') {
      throw new HttpError(404, 'OUTFIT_SKETCH_NOT_FOUND', 'No sketch exists for the provided outfit tier.');
    }

    if (sketch.sketchImageData) {
      return {
        mimeType: sketch.sketchMimeType ?? 'image/jpeg',
        data: sketch.sketchImageData,
      };
    }

    if (sketch.sketchStorageKey) {
      return {
        redirectUrl: `${env.STORAGE_PUBLIC_BASE_URL}/media/${sketch.sketchStorageKey}`,
      };
    }

    throw new HttpError(404, 'OUTFIT_SKETCH_NOT_FOUND', 'No sketch exists for the provided outfit tier.');
  },

  async generateOutfits(input: GenerateOutfitsRequest, supabaseUserId: string, variantMap?: Partial<Record<OutfitTierSlug, number>>) {
    const selectedTiers = CANONICAL_TIERS.filter((tier) => input.selectedTiers.includes(tier));
    // generateOnlyTier: limit what OpenAI generates to one tier while DB stores the full selection.
    const tiersToGenerate = input.generateOnlyTier
      ? selectedTiers.filter((t) => t === input.generateOnlyTier)
      : selectedTiers;
    const anchorItems = getNormalizedAnchorItems(input);
    const profile = await findProfile(supabaseUserId, input.profileId);
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const primaryUploadedAnchorImage = uploadedAnchorImages.find(Boolean) ?? null;

    // When vibe keywords are provided they take precedence over the profile's saved
    // fitPreference and stylePreference for this request. This affects both the
    // style-guide retrieval query (so the fetched guidance reflects the vibe) and
    // the prompt (via formatProfileContext — see outfits.prompts.ts).
    const vibeKeywords = input.vibeKeywords?.trim() || null;

    // closetOnly hands the model the full wardrobe index and requires every
    // recommendation to be built from real ids — mirrors trips.service.ts's
    // "From My Closet" pattern.
    const closetIndex = input.closetOnly ? await buildClosetIndex(supabaseUserId) : null;

    const [styleGuideContext, seasonalTrends] = await Promise.all([
      styleGuideService.retrieveGuidance({
        task: 'outfit-generation',
        query: buildOutfitGenerationStyleGuideQuery({
          profile,
          anchorItems,
          tiersToGenerate,
          manualSeason: input.manualSeason,
          weatherSeason: input.weatherContext?.season,
          vibeKeywords,
        }),
      }),
      loadSeasonalTrends(profile, input.hemisphere, supabaseUserId),
    ]);
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildGenerateOutfitsUserPrompt(
          {
            ...input,
            anchorItems,
            selectedTiers: tiersToGenerate,
            anchorItemDescription: getCanonicalAnchorDescription(input),
          },
          profile,
          styleGuideContext?.promptContext,
          seasonalTrends,
          closetIndex?.index,
        ),
      },
    ];

    userContent.push(...await buildAnchorImageContent(uploadedAnchorImages, anchorItems));

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: tieredOutfitGenerationSchema,
      jsonSchema: {
        name: 'tiered_outfit_generation',
        description: profile?.gender === 'woman' ? 'Three womenswear outfit tiers for one anchor item.' : 'Three menswear outfit tiers for one anchor item.',
        schema: buildTieredOutfitGenerationJsonSchema(!!input.closetOnly),
      },
      instructions: buildGenerateOutfitsInstructions(tiersToGenerate, profile?.gender, input.closetOnly),
      userContent,
      supabaseUserId,
      feature: 'outfit-generation',
    });

    // Never trust the model's ids at face value — drop any id that isn't
    // actually in the wardrobe index rather than pretending the user owns
    // an item that doesn't exist.
    const recommendationMap = new Map(aiOutput.recommendations.map((recommendation) => [
      recommendation.tier,
      closetIndex
        ? { ...recommendation, closetItemIds: (recommendation.closetItemIds ?? []).filter((id) => closetIndex.itemsById.has(id)) }
        : recommendation,
    ]));

    const response: OutfitResponse = {
      requestId: input.requestId,
      status: 'completed' as const,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      input: {
        anchorItems,
        anchorItemDescription: getCanonicalAnchorDescription(input),
        vibeKeywords: input.vibeKeywords?.trim() || undefined,
        anchorImageId: input.anchorImageId ?? primaryUploadedAnchorImage?.id ?? null,
        anchorImageUrl: input.anchorImageUrl ?? primaryUploadedAnchorImage?.publicUrl ?? anchorItems[0]?.imageUrl ?? null,
        photoPending: input.photoPending,
        selectedTiers,
        weatherContext: input.weatherContext ?? null,
        manualSeason: input.manualSeason ?? null,
        hemisphere: input.hemisphere,
        region: input.region,
        includeBag: input.includeBag ?? false,
        includeHat: input.includeHat ?? false,
        closetOnly: input.closetOnly ?? false,
        additionalDetails: input.additionalDetails?.trim() || undefined,
        trendiness: input.trendiness,
      },
      recommendations: tiersToGenerate.map((tier) => {
        const recommendation = recommendationMap.get(tier);

        if (!recommendation) {
          throw new HttpError(502, 'OPENAI_MISSING_TIER', `The AI provider did not return the ${tier} recommendation.`);
        }

        return mapOutfitRecommendation(
          recommendation,
          tier,
          buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, input.requestId, tier, variantMap?.[tier] ?? 0),
          variantMap?.[tier] ?? 0,
          getCanonicalAnchorDescription(input),
        );
      }),
    };

    await outfitsRepository.upsertGeneratedOutfit(input.profileId, response, supabaseUserId);
    void tierSketchService.queueSketchesForOutfit(response, profileToSubject(profile), supabaseUserId);
    outfitsService.pruneOutfitHistory(supabaseUserId).catch((error) => {
      logger.error({ supabaseUserId, error }, 'Outfit history prune failed');
    });
    return response;
  },

  async regenerateTier(requestId: string, tier: OutfitTierSlug, supabaseUserId: string) {
    const existing = await outfitsRepository.findGeneratedOutfit(requestId);

    if (!existing) {
      throw new HttpError(404, 'OUTFIT_REQUEST_NOT_FOUND', 'No outfit request exists for the provided id.');
    }

    const currentRecommendation = existing.recommendations.find((item) => item.tier === tier);
    const currentVariantIndex = currentRecommendation?.variantIndex ?? 0;
    const nextVariantIndex = currentVariantIndex + 1;
    const profile = await findProfile(supabaseUserId);
    const anchorItems = getNormalizedAnchorItems(existing.input);
    const closetIndex = existing.input.closetOnly ? await buildClosetIndex(supabaseUserId) : null;
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const [styleGuideContext, seasonalTrends] = await Promise.all([
      styleGuideService.retrieveGuidance({
        task: 'tier-regeneration',
        query: buildOutfitRegenerationStyleGuideQuery({
          profile,
          tier,
          anchorItems,
          manualSeason: existing.input.manualSeason,
          weatherSeason: existing.input.weatherContext?.season,
          currentStylingDirection: currentRecommendation?.stylingDirection,
        }),
      }),
      loadSeasonalTrends(profile, existing.input.hemisphere, supabaseUserId),
    ]);
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildRegenerateTierUserPrompt({
          profile,
          existing,
          tier,
          styleGuideContext: styleGuideContext?.promptContext,
          seasonalTrends,
          closetIndex: closetIndex?.index,
        }),
      },
    ];

    userContent.push(...await buildAnchorImageContent(uploadedAnchorImages, anchorItems));

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: singleTierRegenerationSchema,
      jsonSchema: {
        name: 'single_tier_regeneration',
        description: profile?.gender === 'woman' ? 'A single regenerated womenswear tier recommendation.' : 'A single regenerated menswear tier recommendation.',
        schema: buildSingleTierRegenerationJsonSchema(!!existing.input.closetOnly),
      },
      instructions: buildRegenerateTierInstructions(profile?.gender, existing.input.closetOnly),
      userContent,
      supabaseUserId,
      feature: 'tier-regeneration',
    });

    // Never trust the model's ids at face value — see generateOutfits' same guard.
    const regeneratedRecommendation = closetIndex
      ? { ...aiOutput.recommendation, closetItemIds: (aiOutput.recommendation.closetItemIds ?? []).filter((id) => closetIndex.itemsById.has(id)) }
      : aiOutput.recommendation;

    const mergedResponse: OutfitResponse = {
      ...existing,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      recommendations: existing.recommendations.map((recommendation) =>
        recommendation.tier === tier
          ? mapOutfitRecommendation(
              regeneratedRecommendation,
              tier,
              buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, existing.requestId, tier, nextVariantIndex),
              nextVariantIndex,
              existing.input.anchorItemDescription,
            )
          : recommendation
      ),
    };

    await outfitsRepository.upsertGeneratedOutfit(undefined, mergedResponse);
    void tierSketchService.queueSketchForTier(mergedResponse, tier, profileToSubject(profile), supabaseUserId);
    return mergedResponse;
  },

  /**
   * Deletes this user's outfit history beyond the most recent HISTORY_RETENTION_LIMIT,
   * skipping anything currently favourited or assigned to a week day. Safe to call
   * repeatedly/concurrently — a delete of an already-deleted id is a no-op.
   *
   * findProtectedRequestIds queries Supabase-managed tables (saved_outfits/week_plan)
   * that turned out NOT to be reachable from this Postgres connection ("relation
   * does not exist") — that error was thrown from an un-awaited, uncaught fire-and-forget
   * call, which crashed the whole Node process (Render: "exited with status 1") on every
   * History-tab open. If we can't positively verify what's protected, do NOT delete
   * anything this round — better to skip a cleanup pass than risk deleting something
   * that's actually favourited/planned.
   */
  async pruneOutfitHistory(supabaseUserId: string, keep: number = HISTORY_RETENTION_LIMIT) {
    const beyondLimit = await outfitsRepository.findHistoryRequestIdsBeyondLimit(supabaseUserId, keep);
    if (beyondLimit.length === 0) return 0;

    let protectedIds: Set<string>;
    try {
      protectedIds = await outfitsRepository.findProtectedRequestIds(beyondLimit);
    } catch (error) {
      logger.error({ supabaseUserId, error }, 'Could not verify saved/planned outfits — skipping history prune this round');
      return 0;
    }

    const toDelete = beyondLimit.filter((id) => !protectedIds.has(id));
    if (toDelete.length === 0) return 0;

    return outfitsRepository.deleteOutfitsByRequestIds(toDelete);
  },

  async getOutfitHistory(supabaseUserId: string, { page, limit }: { page: number; limit: number }) {
    // Page 1 doubles as the cleanup trigger — items beyond HISTORY_RETENTION_LIMIT
    // are never on page 1 (limit is always far below the retention count), so this
    // can't race with or affect what's actually returned below. .catch() is load-bearing:
    // an unawaited rejection here is an unhandled rejection, which crashes the process.
    if (page === 1) {
      outfitsService.pruneOutfitHistory(supabaseUserId).catch((error) => {
        logger.error({ supabaseUserId, error }, 'Outfit history prune failed');
      });
    }

    const { items, total } = await outfitsRepository.findOutfitHistory(supabaseUserId, { page, limit });
    return {
      items: items.map((outfit) => ({
        ...outfit,
        recommendations: outfit.recommendations.map((rec) => ({
          ...rec,
          sketchImageUrl:
            rec.sketchStatus === 'ready'
              ? buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, outfit.requestId, rec.tier, `${outfit.generatedAt}-${rec.variantIndex}`)
              : null,
        })),
      })),
      total,
      page,
      hasMore: page * limit < total,
    };
  },

  async deleteOutfit(requestId: string, supabaseUserId: string) {
    let protectedIds: Set<string>;
    try {
      protectedIds = await outfitsRepository.findProtectedRequestIds([requestId]);
    } catch (error) {
      logger.error({ requestId, error }, 'Could not verify saved/planned outfits — refusing delete to be safe');
      throw new HttpError(503, 'PROTECTION_CHECK_FAILED', 'Could not verify this look is safe to delete. Please try again.');
    }
    if (protectedIds.has(requestId)) {
      throw new HttpError(409, 'OUTFIT_SAVED', 'This look is saved to Favourites or your Week planner — remove it there first.');
    }

    const deleted = await outfitsRepository.deleteOutfit(requestId, supabaseUserId);
    if (!deleted) {
      throw new HttpError(404, 'OUTFIT_NOT_FOUND', 'No outfit exists for the provided id or you do not have permission to delete it.');
    }
  },
};
