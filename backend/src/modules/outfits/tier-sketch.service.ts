import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { imageGenerationClient } from '../../ai/image-generation-client.js';
import { buildTierSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import { buildBodyTypeSeverity } from '../../ai/body-type-severity.js';
import type { OutfitResponse, OutfitTierSlug, TierRecommendationDto } from '../../contracts/outfits.contracts.js';
import { storageProvider } from '../../storage/index.js';
import { outfitsRepository } from './outfits.repository.js';
import { resolveAnchorDescriptionForSketch } from './anchor-description.service.js';

function formatTierLabel(tier: OutfitTierSlug) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

async function generateSingleTierSketch(
  requestId: string,
  anchorItemDescription: string,
  anchorAntiDrift: string | null,
  recommendation: TierRecommendationDto,
  supabaseUserId?: string,
  gender?: string | null,
  bodyType?: string | null,
  fitTendency?: string | null,
  heightCm?: number | null,
  weightKg?: number | null,
) {
  try {
    const severity = buildBodyTypeSeverity(heightCm, weightKg, bodyType);
    const combinedNegative = [severity.negativePrompt, anchorAntiDrift].filter(Boolean).join(', ') || undefined;

    const generatedImage = await imageGenerationClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
        gender,
        bodyTypeDescription: severity.description,
        fitTendency,
      }),
      loraType: 'outfit',
      supabaseUserId,
      additionalNegativePrompt: combinedNegative,
    });

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'tier-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await outfitsRepository.updateTierSketch(requestId, recommendation.tier, {
      sketchStatus: 'ready',
      sketchImageUrl: `${env.STORAGE_PUBLIC_BASE_URL}/outfits/${requestId}/sketch/${recommendation.tier}`,
      sketchStorageKey: storedFile.storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        tier: recommendation.tier,
        error,
      },
      'Tier sketch generation failed'
    );

    await outfitsRepository.updateTierSketch(requestId, recommendation.tier, {
      sketchStatus: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
    });
  }
}

export const tierSketchService = {
  async queueSketchesForOutfit(outfit: OutfitResponse, supabaseUserId?: string, gender?: string | null, bodyType?: string | null, fitTendency?: string | null, heightCm?: number | null, weightKg?: number | null) {
    const { description: anchorItemDescription, antiDrift: anchorAntiDrift } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription, anchorAntiDrift },
      'Anchor description resolved for tier sketches'
    );

    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorAntiDrift, recommendation, supabaseUserId, gender, bodyType, fitTendency, heightCm, weightKg)
      )
    );
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug, supabaseUserId?: string, gender?: string | null, bodyType?: string | null, fitTendency?: string | null, heightCm?: number | null, weightKg?: number | null) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    const { description: anchorItemDescription, antiDrift: anchorAntiDrift } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);
    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorAntiDrift, recommendation, supabaseUserId, gender, bodyType, fitTendency, heightCm, weightKg);
  },
};
