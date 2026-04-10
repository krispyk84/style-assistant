import { z } from 'zod';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { falClient } from '../../ai/fal-client.js';
import { buildTierSketchPrompt, getAnchorDriftNegatives } from '../../ai/prompts/sketch.prompts.js';
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
  category: z.string(),
  description: z.string(),
});

type AnchorSketchInfo = { category: string; description: string };

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
        description: 'Category and structural description of any fashion item for sketch generation',
        schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description:
                'Most specific lowercase item family name. Use precise names: "bomber jacket" not "jacket", "chelsea boot" not "boot", "tote bag" not "bag", "bucket hat" not "hat", "D-ring canvas belt" not "belt". Examples: "bomber jacket", "overshirt", "blazer", "puffer vest", "chore jacket", "trench coat", "tote bag", "backpack", "briefcase", "derby shoe", "loafer", "chelsea boot", "sneaker", "bucket hat", "baseball cap", "beanie", "fedora", "belt", "watch", "sunglasses".',
            },
            description: {
              type: 'string',
              description:
                'One sentence with precise colour (warm/cool qualifier) followed by structural identity features, comma-separated. The description must name the features that distinguish this item from similar items in its family. ' +
                'Garments: colour + garment family, collar type, closure mechanism, lapels present/absent, hem and cuff finish, pocket placement. ' +
                'Example: "Cool grey-taupe bomber jacket, ribbed band collar, front zip closure, no lapels, patch hip pockets, elasticated hem and cuffs." ' +
                'Footwear: colour + shoe family, toe shape (round/square/pointed), heel type, closure method (lace/buckle/zip/slip-on). ' +
                'Example: "Warm tan suede chelsea boot, round toe, stacked block heel, elasticated side gussets, no lace closure." ' +
                'Bags: colour + material + bag family, handle type (tote handles/shoulder strap/crossbody/top-handle), hardware colour, shape (structured/slouchy). ' +
                'Example: "Warm cognac leather tote bag, long rolled top handles, open top, structured base, gold hardware." ' +
                'Belts: colour + material + belt family, width (narrow/medium/wide), buckle type (D-ring/frame/plate), hardware colour. ' +
                'Hats: colour + hat family, brim shape and width, crown shape, any band or trim. ' +
                'Eyewear: frame colour + frame shape (rectangular/round/aviator/cat-eye), lens colour, bridge style. ' +
                'Watches/jewellery: metal tone + piece type, case shape, strap material and colour. ' +
                'Never use ambiguous single-word colours like "taupe" or "beige" alone — always add a warm/cool qualifier.',
            },
          },
          required: ['category', 'description'],
          additionalProperties: false,
        },
      },
      instructions:
        'You are a fashion illustrator preparing a precise brief for a sketch artist. Your job is to identify the exact item family and describe its visual construction so the artist can reproduce it faithfully without confusing it with similar items.\n\n' +
        'CATEGORY: Use the most specific lowercase name available. Examples: "bomber jacket" not "jacket", "chelsea boot" not "boot", "tote bag" not "bag".\n\n' +
        'DESCRIPTION: One sentence, comma-separated structural features.\n' +
        'Start with precise colour — always add warm/cool undertone qualifier (e.g. "cool grey-taupe", "warm olive green", "icy blue-grey"). Never use ambiguous single words alone.\n' +
        'Then describe the structural features that make this item visually distinct from similar items in the same family:\n' +
        '- Garments: exact family name, collar type, closure mechanism, lapels present/absent, hem and cuff finish, pocket placement.\n' +
        '- Footwear: exact family name, toe shape (round/square/pointed), heel type, closure method (lace/buckle/zip/slip-on).\n' +
        '- Bags: exact family name, handle type, hardware colour, shape character (structured/slouchy, tall/wide).\n' +
        '- Belts: exact family name, width, buckle type (D-ring/frame/plate), material texture.\n' +
        '- Hats: exact family name, brim shape, crown shape, any band or trim.\n' +
        '- Eyewear: exact frame shape (rectangular/round/aviator/cat-eye), frame colour, lens colour.\n' +
        '- Watches/jewellery: exact piece type, case shape, strap material, metal tone.',
      userContent: [
        { type: 'input_image', image_url: imageUrl, detail: 'high' },
        {
          type: 'input_text',
          text: 'Identify this fashion item\'s exact category and describe its visual construction in one sentence for a sketch artist. Include colour (warm or cool qualifier) and the specific structural features that distinguish it from similar items in the same family.',
        },
      ],
      supabaseUserId,
      feature: 'anchor-sketch-describe',
    });

    return { category: result.category, description: result.description };
  } catch (error) {
    logger.warn({ imageUrl, error }, 'Failed to describe anchor image for sketch — using text description fallback');
    return null;
  }
}

async function generateSingleTierSketch(
  requestId: string,
  anchorItemDescription: string,
  anchorCategory: string | null,
  recommendation: TierRecommendationDto,
  supabaseUserId?: string,
  gender?: string | null
) {
  try {
    // Inject category-specific drift suppression so Flux cannot substitute a
    // tier-appropriate archetype (e.g. "blazer" when the anchor is a bomber jacket).
    const driftNegatives = anchorCategory ? getAnchorDriftNegatives(anchorCategory) : '';

    const generatedImage = await falClient.generateImage({
      prompt: buildTierSketchPrompt({
        tierLabel: formatTierLabel(recommendation.tier),
        anchorItemDescription,
        recommendation,
        gender,
      }),
      loraType: 'outfit',
      supabaseUserId,
      additionalNegativePrompt: driftNegatives || undefined,
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
 * Resolves the best anchor description and category for sketch generation.
 *
 * Returns { description, category } where:
 * - description: used verbatim as the locked anchor in the sketch prompt
 * - category: used to look up category-specific drift negatives for the negative prompt
 *
 * When multiple anchor items are present, each is described independently.
 * Descriptions are joined with " | ". The first anchor's category is used for
 * drift negatives (multi-anchor is uncommon and the primary anchor drives fidelity).
 */
async function resolveAnchorDescriptionForSketch(
  outfit: OutfitResponse,
  supabaseUserId?: string
): Promise<{ description: string; category: string | null }> {
  const anchorItems = outfit.input.anchorItems;

  if (anchorItems && anchorItems.length > 1) {
    const results = await Promise.all(
      anchorItems.map(async (item, index) => {
        const imageUrl = item.imageUrl ?? null;
        if (imageUrl) {
          return (
            (await describeAnchorForSketch(imageUrl, supabaseUserId)) ??
            { category: null, description: item.description.trim() || `Anchor item ${index + 1}` }
          );
        }
        return { category: null, description: item.description.trim() || `Anchor item ${index + 1}` };
      })
    );
    return {
      description: results.map((r) => r.description).filter(Boolean).join(' | '),
      category: results[0]?.category ?? null,
    };
  }

  const anchorImageUrl = outfit.input.anchorImageUrl ?? anchorItems?.[0]?.imageUrl ?? null;
  if (anchorImageUrl) {
    const result = await describeAnchorForSketch(anchorImageUrl, supabaseUserId);
    return result ?? { description: outfit.input.anchorItemDescription, category: null };
  }

  return { description: outfit.input.anchorItemDescription, category: null };
}

export const tierSketchService = {
  async queueSketchesForOutfit(outfit: OutfitResponse, supabaseUserId?: string, gender?: string | null) {
    const { description: anchorItemDescription, category: anchorCategory } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);

    logger.info(
      { requestId: outfit.requestId, anchorItemDescription, anchorCategory },
      'Anchor description resolved for tier sketches'
    );

    await Promise.all(
      outfit.recommendations.map((recommendation) =>
        generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorCategory, recommendation, supabaseUserId, gender)
      )
    );
  },

  async queueSketchForTier(outfit: OutfitResponse, tier: OutfitTierSlug, supabaseUserId?: string, gender?: string | null) {
    const recommendation = outfit.recommendations.find((item) => item.tier === tier);

    if (!recommendation) {
      return;
    }

    const { description: anchorItemDescription, category: anchorCategory } =
      await resolveAnchorDescriptionForSketch(outfit, supabaseUserId);
    await generateSingleTierSketch(outfit.requestId, anchorItemDescription, anchorCategory, recommendation, supabaseUserId, gender);
  },
};
