import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildTierSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import { buildSubjectRenderingBrief } from '../../ai/body-type-severity.js';
import type { OutfitResponse, OutfitTierSlug, TierRecommendationDto } from '../../contracts/outfits.contracts.js';
import { storageProvider } from '../../storage/index.js';
import { outfitsRepository } from './outfits.repository.js';
import { resolveAnchorDescriptionForSketch, type AnchorColorMetadata } from './anchor-description.service.js';

function formatTierLabel(tier: OutfitTierSlug) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

async function generateSingleTierSketch(
  requestId: string,
  anchorItemDescription: string,
  anchorColorMetadata: AnchorColorMetadata | null,
  subjectBrief: string,
  recommendation: TierRecommendationDto,
  supabaseUserId?: string,
) {
  try {
    const prompt = buildTierSketchPrompt({
      tierLabel: formatTierLabel(recommendation.tier),
      anchorItemDescription,
      anchorColorMetadata,
      subjectBrief,
      recommendation,
    });

    logger.info(
      {
        requestId,
        tier: recommendation.tier,
        anchorColorMetadata,
        promptColorSection: prompt.slice(prompt.indexOf('ANCHOR COLOR'), prompt.indexOf('ANCHOR COLOR') + 500).trim() || '(no color lock)',
      },
      '[anchor-color] Sketch prompt color lock'
    );

    const generatedImage = await openAiClient.generateImage({
      prompt,
      model: env.OPENAI_OUTFIT_SKETCH_MODEL,
      size: '1024x1536',
      quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
      outputFormat: 'jpeg',
      supabaseUserId,
      feature: 'outfit-sketch',
      costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
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
  async queueSketchesForOutfit(
    outfit: OutfitResponse,
    supabaseUserId?: string,
    gender?: string | null,
    bodyType?: string | null,
    fitTendency?: string | null,
    fitPreference?: string | null,
    heightCm?: number | null,
    weightKg?: number | null,
    weightDistribution?: string | null,
    skinTone?: string | null,
  ) {
    const { description: anchorItemDescription, colorMetadata } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    // Build once — identical across all tiers so the figure never changes between Business/Smart Casual/Casual.
    const { block: subjectBrief } = buildSubjectRenderingBrief({
      heightCm, weightKg, bodyType, gender, weightDistribution, fitTendency, skinTone,
    });

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief },
      '[sketch] Anchor + subject brief resolved for tier sketches'
    );

    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief, recommendation, supabaseUserId)
      )
    );
  },

  async queueSketchForTier(
    outfit: OutfitResponse,
    tier: OutfitTierSlug,
    supabaseUserId?: string,
    gender?: string | null,
    bodyType?: string | null,
    fitTendency?: string | null,
    fitPreference?: string | null,
    heightCm?: number | null,
    weightKg?: number | null,
    weightDistribution?: string | null,
    skinTone?: string | null,
  ) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);
    if (!recommendation) return;

    const { description: anchorItemDescription, colorMetadata } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    const { block: subjectBrief } = buildSubjectRenderingBrief({
      heightCm, weightKg, bodyType, gender, weightDistribution, fitTendency, skinTone,
    });

    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief, recommendation, supabaseUserId);
  },
};
