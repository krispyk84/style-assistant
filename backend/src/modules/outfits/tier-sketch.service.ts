import { z } from 'zod';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { imageGenerationClient } from '../../ai/image-generation-client.js';
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
  antiDrift: z.string(),
});

type AnchorSketchInfo = { description: string; antiDrift: string };

/**
 * Calls OpenAI vision to produce a structurally precise description of ANY anchor item
 * (garments, footwear, bags, belts, hats, eyewear, watches, jewellery) for sketch generation.
 *
 * Returns { category, description } where:
 * - category: the canonical lowercase item family (e.g. "bomber jacket", "tote bag", "chelsea boot")
 *   used to look up category-specific drift negatives for the Flux negative prompt.
 * - description: one sentence of colour + structural identity features, used verbatim in the
 *   sketch prompt as the locked anchor declaration.
 *
 * The description quality here directly drives anchor fidelity in the final sketch —
 * richer structural detail = less room for the model to substitute a tier archetype.
 *
 * Returns null on failure — callers fall back to the plain-text anchorItemDescription.
 */
async function describeAnchorForSketch(imageUrl: string, supabaseUserId?: string): Promise<AnchorSketchInfo | null> {
  try {
    const result = await openAiClient.createStructuredResponse({
      schema: anchorSketchDescriptionSchema,
      jsonSchema: {
        name: 'anchor_sketch_description',
        description: 'Structural description and drift-suppression terms for any fashion item',
        schema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description:
                'One sentence with precise colour (warm/cool qualifier) followed by structural identity features, comma-separated. ' +
                'Garments: colour + exact family name, collar type, closure mechanism, lapels present/absent, hem and cuff finish, pocket placement. ' +
                'Example: "Cool grey-taupe bomber jacket, ribbed band collar, front zip closure, no lapels, patch hip pockets, elasticated hem and cuffs." ' +
                'Footwear: colour + exact family name, toe shape (round/square/pointed), heel type, closure method (lace/buckle/zip/slip-on). ' +
                'Example: "Warm tan suede chelsea boot, round toe, stacked block heel, elasticated side gussets, slip-on." ' +
                'Bags: colour + material + exact family name, handle type, hardware colour, shape (structured/slouchy). ' +
                'Example: "Warm cognac leather tote bag, long rolled top handles, open top, structured base, gold hardware." ' +
                'Belts: colour + material + exact family name, width, buckle type, hardware colour. ' +
                'Hats: colour + exact family name, brim shape, crown shape, any band or trim. ' +
                'Eyewear: frame colour + exact frame shape, lens colour. ' +
                'Watches/jewellery: metal tone + piece type, case shape, strap material. ' +
                'Never use ambiguous single-word colours — always add warm/cool qualifier.',
            },
            antiDrift: {
              type: 'string',
              description:
                'Comma-separated terms for the sketch negative prompt — the wrong item types and structural features a fashion illustration model commonly substitutes for this item. ' +
                'Think: given a "business" or "smart casual" styling brief, what would the model wrongly draw instead? ' +
                'Include BOTH the wrong category names AND their most distinctive structural features. ' +
                'Examples: ' +
                'overshirt → "blazer, lapels, notched lapels, peaked lapels, suit jacket, tailored jacket" (lapels are the structural signature of a blazer); ' +
                'bomber jacket → "blazer, lapels, notched lapels, field jacket, tailored jacket"; ' +
                'tote bag → "briefcase, structured flap handbag, shoulder bag with clasp"; ' +
                'chelsea boot → "ankle boot with laces, desert boot"; ' +
                'bucket hat → "baseball cap, peaked brim cap". ' +
                'If the item is unlikely to be misidentified (e.g. a watch, sunglasses), return empty string.',
            },
          },
          required: ['description', 'antiDrift'],
          additionalProperties: false,
        },
      },
      instructions:
        'You are a fashion illustrator preparing a brief for a sketch artist and a generation system. ' +
        'Describe the item\'s visual construction precisely (description), then identify what a fashion illustration model would wrongly substitute for it under business/smart-casual styling pressure (antiDrift).\n\n' +
        'DESCRIPTION: One sentence, comma-separated. Start with precise colour (warm/cool qualifier). ' +
        'Then list structural features that make this item uniquely identifiable: for garments include collar, closure, lapels present/absent, hem, cuffs, pockets; ' +
        'for footwear include toe shape, heel, closure; for bags include handle type, hardware, shape; ' +
        'for belts include width, buckle type; for hats include brim and crown; for eyewear include frame shape and lens colour.\n\n' +
        'ANTI_DRIFT: What would a model draw INSTEAD of this item when given a formal/business styling prompt? ' +
        'List those wrong categories AND their distinctive structural features (e.g. lapels for blazers, laces for derby shoes). ' +
        'This goes directly into the negative prompt so be specific and visual, not abstract.',
      userContent: [
        { type: 'input_image', image_url: imageUrl, detail: 'high' },
        {
          type: 'input_text',
          text: 'Describe this fashion item for a sketch artist (colour + structural features), then list what a fashion illustration model would wrongly draw instead of it under business/formal styling pressure.',
        },
      ],
      supabaseUserId,
      feature: 'anchor-sketch-describe',
    });

    return { description: result.description, antiDrift: result.antiDrift };
  } catch (error) {
    logger.warn({ imageUrl, error }, 'Failed to describe anchor image for sketch — using text description fallback');
    return null;
  }
}

async function generateSingleTierSketch(
  requestId: string,
  anchorItemDescription: string,
  anchorAntiDrift: string | null,
  recommendation: TierRecommendationDto,
  supabaseUserId?: string,
  gender?: string | null
) {
  try {
    const generatedImage = await imageGenerationClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
        gender,
      }),
      loraType: 'outfit',
      supabaseUserId,
      additionalNegativePrompt: anchorAntiDrift || undefined,
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
 * Resolves the best anchor description and image-derived anti-drift terms for sketch generation.
 *
 * Returns { description, antiDrift } where:
 * - description: used verbatim as the locked anchor in the sketch prompt
 * - antiDrift: comma-separated terms derived from the anchor image by OpenAI vision,
 *   injected directly into the negative prompt — no hardcoded category lookup table needed.
 *
 * For multi-anchor outfits, descriptions are joined with " | " and antiDrift terms
 * are merged (the primary anchor's terms dominate since it drives fidelity).
 */
async function resolveAnchorDescriptionForSketch(
  outfit: OutfitResponse,
  supabaseUserId?: string
): Promise<{ description: string; antiDrift: string | null }> {
  const anchorItems = outfit.input.anchorItems;

  if (anchorItems && anchorItems.length > 1) {
    const results = await Promise.all(
      anchorItems.map(async (item, index) => {
        const imageUrl = item.imageUrl ?? null;
        if (imageUrl) {
          return (
            (await describeAnchorForSketch(imageUrl, supabaseUserId)) ??
            { antiDrift: null, description: item.description.trim() || `Anchor item ${index + 1}` }
          );
        }
        return { antiDrift: null, description: item.description.trim() || `Anchor item ${index + 1}` };
      })
    );
    const mergedAntiDrift = results.map((r) => r.antiDrift).filter(Boolean).join(', ') || null;
    return {
      description: results.map((r) => r.description).filter(Boolean).join(' | '),
      antiDrift: mergedAntiDrift,
    };
  }

  const anchorImageUrl = outfit.input.anchorImageUrl ?? anchorItems?.[0]?.imageUrl ?? null;
  if (anchorImageUrl) {
    const result = await describeAnchorForSketch(anchorImageUrl, supabaseUserId);
    return result ?? { description: outfit.input.anchorItemDescription, antiDrift: null };
  }

  return { description: outfit.input.anchorItemDescription, antiDrift: null };
}

export const tierSketchService = {
  async queueSketchesForOutfit(outfit: OutfitResponse, supabaseUserId?: string, gender?: string | null) {
    const { description: anchorItemDescription, antiDrift: anchorAntiDrift } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription, anchorAntiDrift },
      'Anchor description resolved for tier sketches'
    );

    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorAntiDrift, recommendation, supabaseUserId, gender)
      )
    );
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug, supabaseUserId?: string, gender?: string | null) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    const { description: anchorItemDescription, antiDrift: anchorAntiDrift } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);
    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorAntiDrift, recommendation, supabaseUserId, gender);
  },
};
