import { z } from 'zod';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
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

const anchorSketchDescriptionSchema = z.object({
  description: z.string(),
});

/**
 * Calls OpenAI vision to produce a silhouette-focused description of the anchor
 * garment image. This description is used exclusively for sketch generation and
 * is optimised for structural fidelity — it names collar construction, closure
 * type, lapels (or absence of), hem and cuff details, and pocket placement so
 * that Flux cannot substitute a tier-appropriate garment family (e.g. a blazer
 * for a bomber when the tier is "business").
 *
 * Returns null if the image is unavailable or the call fails — callers fall back
 * to the plain text anchorItemDescription.
 */
async function describeAnchorForSketch(imageUrl: string, supabaseUserId?: string): Promise<string | null> {
  try {
    const result = await openAiClient.createStructuredResponse({
      schema: anchorSketchDescriptionSchema,
      jsonSchema: {
        name: 'anchor_sketch_description',
        description: 'Structural silhouette description of a garment for fashion sketch generation',
        schema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description:
                'Garment type name preceded by precise colour with warm/cool undertone qualifier, followed by structural features: collar/neckline, closure type, lapels present/absent, hem and cuff finish, external pocket placement. 1 sentence, comma-separated. Example: "Cool grey-taupe bomber jacket, ribbed band collar, front zip closure, no lapels, patch hip pockets, elasticated hem and cuffs." Never use ambiguous single-word colours like "taupe" or "beige" alone — always add a warm/cool qualifier.',
            },
          },
          required: ['description'],
          additionalProperties: false,
        },
      },
      instructions:
        'You are a fashion illustrator preparing a brief for a sketch artist. Lead with precise colour — always qualify warm vs cool undertone (e.g. "cool grey-taupe", "warm stone beige", "icy blue-grey"). Never use ambiguous single-word colour names alone. Then describe structural features: garment type, collar construction, closure mechanism, lapels (present or absent), hem and cuff finish, and external pocket placement.',
      userContent: [
        { type: 'input_image', image_url: imageUrl, detail: 'high' },
        {
          type: 'input_text',
          text: 'Describe this garment in one sentence for a sketch artist. Start with precise colour (warm or cool undertone), then cover structural features: garment type, collar, closure, lapels, hem and cuffs, pockets.',
        },
      ],
      supabaseUserId,
      feature: 'anchor-sketch-describe',
    });

    return result.description;
  } catch (error) {
    logger.warn({ imageUrl, error }, 'Failed to describe anchor image for sketch — using text description fallback');
    return null;
  }
}

async function generateSingleTierSketch(
  requestId: string,
  anchorItemDescription: string,
  recommendation: TierRecommendationDto,
  supabaseUserId?: string,
  gender?: string | null
) {
  try {
    const generatedImage = await falClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
        gender,
      }),
      loraType: 'outfit',
      supabaseUserId,
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

/**
 * Resolves the best anchor description for sketch generation.
 *
 * When multiple anchor items are present (each potentially with its own image),
 * each item with an image is described independently and the results are joined
 * with " | " — matching how getCanonicalAnchorDescription handles multi-anchor
 * text. Items without images fall back to their stored text description.
 *
 * The result is computed once per outfit and reused across all tier sketches.
 */
async function resolveAnchorDescriptionForSketch(outfit: OutfitResponse, supabaseUserId?: string): Promise<string> {
  const anchorItems = outfit.input.anchorItems;

  // Multiple anchor items — describe each independently then join
  if (anchorItems && anchorItems.length > 1) {
    const descriptions = await Promise.all(
      anchorItems.map(async (item, index) => {
        const imageUrl = item.imageUrl ?? null;
        if (imageUrl) {
          return (await describeAnchorForSketch(imageUrl, supabaseUserId)) ?? (item.description.trim() || `Anchor item ${index + 1}`);
        }
        return item.description.trim() || `Anchor item ${index + 1}`;
      })
    );
    return descriptions.filter(Boolean).join(' | ');
  }

  // Single anchor — use the primary image URL if available
  const anchorImageUrl = outfit.input.anchorImageUrl ?? anchorItems?.[0]?.imageUrl ?? null;
  if (anchorImageUrl) {
    return (await describeAnchorForSketch(anchorImageUrl, supabaseUserId)) ?? outfit.input.anchorItemDescription;
  }

  return outfit.input.anchorItemDescription;
}

export const tierSketchService = {
  async queueSketchesForOutfit(outfit: OutfitResponse, supabaseUserId?: string, gender?: string | null) {
    const anchorItemDescription = await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription },
      'Anchor description resolved for tier sketches'
    );

    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, anchorItemDescription, recommendation, supabaseUserId, gender)
      )
    );
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug, supabaseUserId?: string, gender?: string | null) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    const anchorItemDescription = await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);
    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, recommendation, supabaseUserId, gender);
  },
};
