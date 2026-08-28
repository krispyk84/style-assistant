import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { describeError } from '../../lib/http-error.js';
import { buildTierSketchPrompt } from '../../ai/prompts/tier-sketch.prompts.js';
import { buildSubjectRenderingBrief, type SubjectRenderingInput } from '../../ai/body-type-severity.js';
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
      logContext: { requestId, tier: recommendation.tier },
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
    const { code, message } = describeError(error);

    logger.error(
      {
        requestId,
        tier: recommendation.tier,
        errorCode: code,
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
      sketchErrorCode: code,
      sketchErrorMessage: message,
    });
  }
}

export const tierSketchService = {
  async queueSketchesForOutfit(
    outfit: OutfitResponse,
    subject: SubjectRenderingInput,
    supabaseUserId?: string,
  ) {
    const { description: anchorItemDescription, colorMetadata } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    // Build once — identical across all tiers so the figure never changes between Business/Smart Casual/Casual.
    const { block: subjectBrief } = buildSubjectRenderingBrief(subject);

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief },
      '[sketch] Anchor + subject brief resolved for tier sketches'
    );

    // Stagger the start of each tier's request — firing all 3 gpt-image-1-mini calls
    // in the same instant is a self-inflicted source of 429 rate-limit failures.
    const STAGGER_MS = 400;
    await Promise.all(
      outfit.recommendations.map(async (recommendation, index) => {
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, index * STAGGER_MS));
        }
        return generateSingleTierSketch(outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief, recommendation, supabaseUserId);
      })
    );
  },

  async queueSketchForTier(
    outfit: OutfitResponse,
    tier: OutfitTierSlug,
    subject: SubjectRenderingInput,
    supabaseUserId?: string,
  ) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);
    if (!recommendation) return;

    const { description: anchorItemDescription, colorMetadata } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    const { block: subjectBrief } = buildSubjectRenderingBrief(subject);

    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, colorMetadata, subjectBrief, recommendation, supabaseUserId);
  },
};
