import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildModelImageInput } from '../../ai/image-input.js';
import {
  singleTierRegenerationJsonSchema,
  singleTierRegenerationSchema,
  tieredOutfitGenerationJsonSchema,
  tieredOutfitGenerationSchema,
} from '../../ai/openai.schemas.js';
import { buildGenerateOutfitsInstructions, buildGenerateOutfitsUserPrompt, buildRegenerateTierInstructions, buildRegenerateTierUserPrompt } from '../../ai/prompts/outfits.prompts.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { outfitsRepository } from './outfits.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import { tierSketchService } from './tier-sketch.service.js';

const CANONICAL_TIERS: OutfitTierSlug[] = ['business', 'smart-casual', 'casual'];

function buildStableSketchUrl(requestId: string, tier: OutfitTierSlug) {
  return `${env.STORAGE_PUBLIC_BASE_URL}/outfits/${requestId}/sketch/${tier}`;
}

function getNormalizedAnchorItems(
  input: {
    anchorItems?: GenerateOutfitsRequest['anchorItems'];
    anchorItemDescription: string;
    anchorImageId?: string | null;
    anchorImageUrl?: string | null;
  }
) {
  if (input.anchorItems?.length) {
    return input.anchorItems
      .filter((item) => item.description.trim() || item.imageId || item.imageUrl)
      .map((item) => ({
        description: item.description,
        ...(item.imageId ? { imageId: item.imageId } : {}),
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      }));
  }

  return [
    {
      description: input.anchorItemDescription,
      ...(input.anchorImageId ? { imageId: input.anchorImageId } : {}),
      ...(input.anchorImageUrl ? { imageUrl: input.anchorImageUrl } : {}),
    },
  ].filter((item) => item.description.trim() || item.imageId || item.imageUrl);
}

function getCanonicalAnchorDescription(input: {
  anchorItems?: GenerateOutfitsRequest['anchorItems'];
  anchorItemDescription: string;
  anchorImageId?: string | null;
  anchorImageUrl?: string | null;
}) {
  const anchorItems = getNormalizedAnchorItems(input);

  if (anchorItems.length > 1) {
    return anchorItems
      .map((item, index) => item.description.trim() || `Anchor item ${index + 1} identified from uploaded image`)
      .join(' | ');
  }

  const description = input.anchorItemDescription.trim();
  if (description) {
    return description;
  }

  if (input.anchorImageId || input.anchorImageUrl) {
    return 'Anchor item identified from uploaded image';
  }

  return 'Anchor item not provided';
}

async function findProfile(profileId?: string) {
  if (profileId) {
    return profileRepository.findById(profileId);
  }

  return profileRepository.findLatest();
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
          recommendation.sketchStatus === 'ready' ? buildStableSketchUrl(requestId, recommendation.tier) : null,
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

  async generateOutfits(input: GenerateOutfitsRequest, variantMap?: Partial<Record<OutfitTierSlug, number>>) {
    const selectedTiers = CANONICAL_TIERS.filter((tier) => input.selectedTiers.includes(tier));
    const anchorItems = getNormalizedAnchorItems(input);
    const profile = await findProfile(input.profileId);
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const primaryUploadedAnchorImage = uploadedAnchorImages.find(Boolean) ?? null;
    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'outfit-generation',
      query: [
        'menswear styling guidance',
        ...anchorItems.map((item, index) => `anchor item ${index + 1}: ${item.description.trim() || 'image-led reference'}`),
        `requested tiers: ${selectedTiers.join(', ')}`,
        input.weatherContext ? `season: ${input.weatherContext.season}` : null,
        profile?.stylePreference ? `user style preference: ${profile.stylePreference}` : null,
        profile?.fitPreference ? `user fit preference: ${profile.fitPreference}` : null,
        profile?.summerBottomPreference ? `summer bottoms preference: ${profile.summerBottomPreference}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    });
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildGenerateOutfitsUserPrompt(
          {
            ...input,
            anchorItems,
            selectedTiers,
            anchorItemDescription: getCanonicalAnchorDescription(input),
          },
          profile,
          styleGuideContext?.promptContext
        ),
      },
    ];

    for (const uploadedAnchorImage of uploadedAnchorImages) {
      if (uploadedAnchorImage) {
        userContent.push(await buildModelImageInput(uploadedAnchorImage));
      }
    }

    anchorItems
      .filter((item) => item.imageUrl && !item.imageId)
      .forEach((item) => {
        userContent.push({
          type: 'input_image',
          image_url: item.imageUrl!,
          detail: 'high',
        });
      });

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: tieredOutfitGenerationSchema,
      jsonSchema: {
        name: 'tiered_outfit_generation',
        description: 'Three menswear outfit tiers for one anchor item.',
        schema: tieredOutfitGenerationJsonSchema,
      },
      instructions: buildGenerateOutfitsInstructions(selectedTiers),
      userContent,
    });

    const recommendationMap = new Map(aiOutput.recommendations.map((recommendation) => [recommendation.tier, recommendation]));

    const response: OutfitResponse = {
      requestId: input.requestId,
      status: 'completed' as const,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      input: {
        anchorItems,
        anchorItemDescription: getCanonicalAnchorDescription(input),
        anchorImageId: input.anchorImageId ?? primaryUploadedAnchorImage?.id ?? null,
        anchorImageUrl: input.anchorImageUrl ?? primaryUploadedAnchorImage?.publicUrl ?? anchorItems[0]?.imageUrl ?? null,
        photoPending: input.photoPending,
        selectedTiers,
        weatherContext: input.weatherContext ?? null,
      },
      recommendations: selectedTiers.map((tier) => {
        const recommendation = recommendationMap.get(tier);

        if (!recommendation) {
          throw new HttpError(502, 'OPENAI_MISSING_TIER', `The AI provider did not return the ${tier} recommendation.`);
        }

        return {
          ...recommendation,
          tier,
          anchorItem: recommendation.anchorItem.trim() || getCanonicalAnchorDescription(input),
          sketchStatus: 'pending',
          sketchImageUrl: buildStableSketchUrl(input.requestId, tier),
          sketchStorageKey: null,
          sketchMimeType: null,
          sketchImageData: null,
          variantIndex: variantMap?.[tier] ?? 0,
        };
      }),
    };

    await outfitsRepository.upsertGeneratedOutfit(input.profileId, response);
    void tierSketchService.queueSketchesForOutfit(response);
    return response;
  },

  async regenerateTier(requestId: string, tier: OutfitTierSlug) {
    const existing = await outfitsRepository.findGeneratedOutfit(requestId);

    if (!existing) {
      throw new HttpError(404, 'OUTFIT_REQUEST_NOT_FOUND', 'No outfit request exists for the provided id.');
    }

    const currentRecommendation = existing.recommendations.find((item) => item.tier === tier);
    const currentVariantIndex = currentRecommendation?.variantIndex ?? 0;
    const nextVariantIndex = currentVariantIndex + 1;
    const profile = await findProfile(undefined);
    const anchorItems = getNormalizedAnchorItems(existing.input);
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'tier-regeneration',
      query: [
        'menswear styling guidance for regenerating one outfit tier',
        `tier: ${tier}`,
        ...anchorItems.map((item, index) => `anchor item ${index + 1}: ${item.description.trim() || 'image-led reference'}`),
        existing.input.weatherContext ? `season: ${existing.input.weatherContext.season}` : null,
        currentRecommendation ? `current styling direction: ${currentRecommendation.stylingDirection}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    });
    const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }> = [
      {
        type: 'input_text',
        text: buildRegenerateTierUserPrompt({
          profile,
          existing,
          tier,
          styleGuideContext: styleGuideContext?.promptContext,
        }),
      },
    ];

    for (const uploadedAnchorImage of uploadedAnchorImages) {
      if (uploadedAnchorImage) {
        userContent.push(await buildModelImageInput(uploadedAnchorImage));
      }
    }

    anchorItems
      .filter((item) => item.imageUrl && !item.imageId)
      .forEach((item) => {
        userContent.push({
          type: 'input_image',
          image_url: item.imageUrl!,
          detail: 'high',
        });
      });

    const aiOutput = await openAiClient.createStructuredResponse({
      schema: singleTierRegenerationSchema,
      jsonSchema: {
        name: 'single_tier_regeneration',
        description: 'A single regenerated menswear tier recommendation.',
        schema: singleTierRegenerationJsonSchema,
      },
      instructions: buildRegenerateTierInstructions(),
      userContent,
    });

    const mergedResponse: OutfitResponse = {
      ...existing,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      recommendations: existing.recommendations.map((recommendation) =>
        recommendation.tier === tier
          ? {
              ...aiOutput.recommendation,
              tier,
              anchorItem: aiOutput.recommendation.anchorItem.trim() || existing.input.anchorItemDescription,
              sketchStatus: 'pending',
              sketchImageUrl: buildStableSketchUrl(existing.requestId, tier),
              sketchStorageKey: null,
              sketchMimeType: null,
              sketchImageData: null,
              variantIndex: nextVariantIndex,
            }
          : recommendation
      ),
    };

    await outfitsRepository.upsertGeneratedOutfit(undefined, mergedResponse);
    void tierSketchService.queueSketchForTier(mergedResponse, tier);
    return mergedResponse;
  },
};
