import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import {
  ANCHOR_SKETCH_DESCRIPTION_INSTRUCTIONS,
  ANCHOR_SKETCH_DESCRIPTION_JSON_SCHEMA,
  ANCHOR_SKETCH_DESCRIPTION_USER_TEXT,
} from '../../ai/prompts/anchor-description.prompts.js';
import type { OutfitResponse } from '../../contracts/outfits.contracts.js';
import { anchorSketchDescriptionSchema } from './anchor-description.schemas.js';
import { extractTextBasedAntiDrift } from './anchor-drift-negatives.js';

// ── Color metadata types ──────────────────────────────────────────────────────

export type AnchorColorSwatch = {
  hex: string;
  name: string;
  placement: string;
};

/**
 * Structured color description extracted directly from the anchor image by vision.
 * This is the ground-truth color data that flows through to the sketch prompt.
 * The hex is sampled from the image — not derived from a static dictionary.
 */
export type AnchorColorMetadata = {
  dominantColorHex: string;
  dominantColorName: string;
  lightnessTone: 'very light' | 'light' | 'medium' | 'dark' | 'very dark';
  temperatureTone: 'warm' | 'neutral' | 'cool';
  isMultiColor: boolean;
  secondaryColors: AnchorColorSwatch[];
  colorPattern: string | null;
};

export type AnchorSketchInfo = {
  description: string;
  antiDrift: string;
  colorMetadata: AnchorColorMetadata | null;
};

// ── Vision prompt ─────────────────────────────────────────────────────────────

/**
 * Calls OpenAI vision to produce a structurally precise description of ANY anchor item
 * (garments, footwear, bags, belts, hats, eyewear, watches, jewellery) for sketch generation.
 *
 * Returns colorMetadata with a directly sampled hex code so the sketch prompt can pin
 * an exact color rather than mapping a color word through a static dictionary.
 */
async function describeAnchorForSketch(imageUrl: string, supabaseUserId?: string): Promise<AnchorSketchInfo | null> {
  try {
    const result = await openAiClient.createStructuredResponse({
      schema: anchorSketchDescriptionSchema,
      jsonSchema: ANCHOR_SKETCH_DESCRIPTION_JSON_SCHEMA,
      instructions: ANCHOR_SKETCH_DESCRIPTION_INSTRUCTIONS,
      userContent: [
        { type: 'input_image', image_url: imageUrl, detail: 'high' },
        { type: 'input_text', text: ANCHOR_SKETCH_DESCRIPTION_USER_TEXT },
      ],
      supabaseUserId,
      feature: 'anchor-sketch-describe',
    });

    logger.info(
      {
        imageUrl,
        colorMetadata: result.colorMetadata,
        description: result.description,
      },
      '[anchor-color] Vision color analysis result'
    );

    return {
      description: result.description,
      antiDrift: result.antiDrift,
      colorMetadata: result.colorMetadata,
    };
  } catch (error) {
    logger.warn({ imageUrl, error }, 'Failed to describe anchor image for sketch — using text description fallback');
    return null;
  }
}

/**
 * Resolves the best anchor description, image-derived anti-drift terms, and color metadata
 * for sketch generation.
 *
 * Returns { description, antiDrift, colorMetadata } where:
 * - description: used verbatim as the locked anchor in the sketch prompt
 * - antiDrift: comma-separated terms derived from the anchor image by OpenAI vision
 * - colorMetadata: vision-extracted color data including hex code (null if vision unavailable)
 */
export async function resolveAnchorDescriptionForSketch(
  outfit: OutfitResponse,
  supabaseUserId?: string
): Promise<{ description: string; antiDrift: string | null; colorMetadata: AnchorColorMetadata | null }> {
  const anchorItems = outfit.input.anchorItems;

  if (anchorItems && anchorItems.length > 1) {
    const results = await Promise.all(
      anchorItems.map(async (item, index) => {
        const imageUrl = item.imageUrl ?? null;
        if (imageUrl) {
          return (
            (await describeAnchorForSketch(imageUrl, supabaseUserId)) ??
            { antiDrift: null, colorMetadata: null, description: item.description.trim() || `Anchor item ${index + 1}` }
          );
        }
        return { antiDrift: null, colorMetadata: null, description: item.description.trim() || `Anchor item ${index + 1}` };
      })
    );
    const mergedAntiDrift = results.map((r) => r.antiDrift).filter(Boolean).join(', ') || null;
    // For multi-anchor, use the primary (first) anchor's color metadata.
    const primaryColorMetadata = results[0]?.colorMetadata ?? null;
    return {
      description: results.map((r) => r.description).filter(Boolean).join(' | '),
      antiDrift: mergedAntiDrift,
      colorMetadata: primaryColorMetadata,
    };
  }

  const anchorImageUrl = outfit.input.anchorImageUrl ?? anchorItems?.[0]?.imageUrl ?? null;
  const anchorDescription = outfit.input.anchorItemDescription;

  if (anchorImageUrl) {
    const result = await describeAnchorForSketch(anchorImageUrl, supabaseUserId);
    if (result) {
      const textDrift = extractTextBasedAntiDrift(anchorDescription);
      const combinedAntiDrift = [result.antiDrift || null, textDrift].filter(Boolean).join(', ') || null;
      return { description: result.description, antiDrift: combinedAntiDrift, colorMetadata: result.colorMetadata };
    }
    return { description: anchorDescription, antiDrift: extractTextBasedAntiDrift(anchorDescription), colorMetadata: null };
  }

  // Text-only anchor: no image, no color metadata.
  return { description: anchorDescription, antiDrift: extractTextBasedAntiDrift(anchorDescription), colorMetadata: null };
}
