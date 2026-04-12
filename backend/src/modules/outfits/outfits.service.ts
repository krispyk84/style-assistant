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
} from './outfits.schemas.js';
import { buildGenerateOutfitsInstructions, buildGenerateOutfitsUserPrompt, buildRegenerateTierInstructions, buildRegenerateTierUserPrompt } from '../../ai/prompts/outfits.prompts.js';
import { getNormalizedAnchorItems, getCanonicalAnchorDescription } from './outfits-prompt-builders.js';
import { buildStableSketchUrl, mapOutfitRecommendation } from './outfits-response-mapper.js';
import { uploadsRepository } from '../uploads/uploads.repository.js';
import { outfitsRepository } from './outfits.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { styleGuideService } from '../style-guides/style-guide.service.js';
import { tierSketchService } from './tier-sketch.service.js';

const CANONICAL_TIERS: OutfitTierSlug[] = ['business', 'smart-casual', 'casual'];


async function findProfile(supabaseUserId: string, profileId?: string) {
  if (profileId) {
    return profileRepository.findById(profileId);
  }
  return profileRepository.findByUserId(supabaseUserId);
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

    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'outfit-generation',
      query: [
        profile?.gender === 'woman' ? 'womenswear styling guidance' : 'menswear styling guidance',
        ...anchorItems.map((item, index) => `anchor item ${index + 1}: ${item.description.trim() || 'image-led reference'}`),
        `requested tiers: ${tiersToGenerate.join(', ')}`,
        input.weatherContext ? `season: ${input.weatherContext.season}` : null,
        // Vibe keywords override saved style/fit for retrieval — only one set is used
        vibeKeywords ? `style direction: ${vibeKeywords}` : null,
        !vibeKeywords && profile?.stylePreference ? `user style preference: ${profile.stylePreference}` : null,
        !vibeKeywords && profile?.fitPreference ? `user fit preference: ${profile.fitPreference}` : null,
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
            selectedTiers: tiersToGenerate,
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
        description: profile?.gender === 'woman' ? 'Three womenswear outfit tiers for one anchor item.' : 'Three menswear outfit tiers for one anchor item.',
        schema: tieredOutfitGenerationJsonSchema,
      },
      instructions: buildGenerateOutfitsInstructions(tiersToGenerate, profile?.gender),
      userContent,
      supabaseUserId,
      feature: 'outfit-generation',
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
        vibeKeywords: input.vibeKeywords?.trim() || undefined,
        anchorImageId: input.anchorImageId ?? primaryUploadedAnchorImage?.id ?? null,
        anchorImageUrl: input.anchorImageUrl ?? primaryUploadedAnchorImage?.publicUrl ?? anchorItems[0]?.imageUrl ?? null,
        photoPending: input.photoPending,
        selectedTiers,
        weatherContext: input.weatherContext ?? null,
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
    void tierSketchService.queueSketchesForOutfit(response, supabaseUserId, profile?.gender, (profile as any)?.bodyType ?? null, (profile as any)?.fitTendency ?? null, profile?.fitPreference ?? null, profile?.heightCm ?? null, profile?.weightKg ?? null);
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
    const uploadedAnchorImages = await Promise.all(
      anchorItems.map(async (item) => (item.imageId ? uploadsRepository.findById(item.imageId) : null))
    );
    const styleGuideContext = await styleGuideService.retrieveGuidance({
      task: 'tier-regeneration',
      query: [
        profile?.gender === 'woman' ? 'womenswear styling guidance for regenerating one outfit tier' : 'menswear styling guidance for regenerating one outfit tier',
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
        description: profile?.gender === 'woman' ? 'A single regenerated womenswear tier recommendation.' : 'A single regenerated menswear tier recommendation.',
        schema: singleTierRegenerationJsonSchema,
      },
      instructions: buildRegenerateTierInstructions(profile?.gender),
      userContent,
      supabaseUserId,
      feature: 'tier-regeneration',
    });

    const mergedResponse: OutfitResponse = {
      ...existing,
      provider: 'openai' as const,
      generatedAt: new Date().toISOString(),
      recommendations: existing.recommendations.map((recommendation) =>
        recommendation.tier === tier
          ? mapOutfitRecommendation(
              aiOutput.recommendation,
              tier,
              buildStableSketchUrl(env.STORAGE_PUBLIC_BASE_URL, existing.requestId, tier, nextVariantIndex),
              nextVariantIndex,
              existing.input.anchorItemDescription,
            )
          : recommendation
      ),
    };

    await outfitsRepository.upsertGeneratedOutfit(undefined, mergedResponse);
    void tierSketchService.queueSketchForTier(mergedResponse, tier, supabaseUserId, profile?.gender, (profile as any)?.bodyType ?? null, (profile as any)?.fitTendency ?? null, profile?.fitPreference ?? null, profile?.heightCm ?? null, profile?.weightKg ?? null);
    return mergedResponse;
  },

  async getOutfitHistory(supabaseUserId: string, { page, limit }: { page: number; limit: number }) {
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
    const deleted = await outfitsRepository.deleteOutfit(requestId, supabaseUserId);
    if (!deleted) {
      throw new HttpError(404, 'OUTFIT_NOT_FOUND', 'No outfit exists for the provided id or you do not have permission to delete it.');
    }
  },
};
