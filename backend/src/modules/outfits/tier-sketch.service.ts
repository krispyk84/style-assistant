import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
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

async function generateSingleTierSketch(requestId: string, anchorItemDescription: string, recommendation: TierRecommendationDto) {
  try {
    const generatedImage = await openAiClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
      }),
      size: '1024x1536',
      quality: 'medium',
      outputFormat: 'jpeg',
    });

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'tier-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await outfitsRepository.updateTierSketch(requestId, recommendation.tier, {
      sketchStatus: 'ready',
      sketchImageUrl: storedFile.publicUrl,
      sketchStorageKey: storedFile.storageKey,
      sketchMimeType: generatedImage.mimeType,
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
    });
  }
}

export const tierSketchService = {
  async queueSketchesForOutfit(outfit: OutfitResponse) {
    for (const recommendation of outfit.recommendations) {
      await generateSingleTierSketch(outfit.requestId, outfit.input.anchorItemDescription, recommendation);
    }
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    await generateSingleTierSketch(outfit.requestId, outfit.input.anchorItemDescription, recommendation);
  },
};
