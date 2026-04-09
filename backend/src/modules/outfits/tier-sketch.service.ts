import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { falClient } from '../../ai/fal-client.js';
import { buildTierSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import type { OutfitResponse, OutfitTierSlug, TierRecommendationDto } from '../../contracts/outfits.contracts.js';
import { storageProvider } from '../../storage/index.js';
import { outfitsRepository } from './outfits.repository.js';

function formatTierLabel(tier: OutfitTierSlug) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

async function generateSingleTierSketch(requestId: string, anchorItemDescription: string, recommendation: TierRecommendationDto, supabaseUserId?: string, gender?: string | null) {
  try {
    const generatedImage = await falClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
        gender,
      }),
      loraType: 'outfit',
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
  async queueSketchesForOutfit(outfit: OutfitResponse, supabaseUserId?: string, gender?: string | null) {
    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, outfit.input.anchorItemDescription, recommendation, supabaseUserId, gender)
      )
    );
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug, supabaseUserId?: string, gender?: string | null) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    await generateSingleTierSketch(outfit.requestId, outfit.input.anchorItemDescription, recommendation, supabaseUserId, gender);
  },
};
