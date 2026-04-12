import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { openAiClient } from '../../ai/openai-client.js';
import { imageGenerationClient } from '../../ai/image-generation-client.js';
import { buildAccessorySketchPrompt, buildClosetItemSketchPrompt, buildSunglassesSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import { closetRepository } from './closet.repository.js';

const garmentDescriptionSchema = z.object({
  description: z.string(),
});

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  // Prefer reading directly from disk — faster and avoids self-HTTP requests on Render.
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      const ext = path.extname(storageKey).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      // File not on disk — fall through to HTTP fetch
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image fetch failed with HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

/**
 * Produces a construction-detail inventory of the garment for use as a sketch prompt.
 *
 * Designed for maximum garment fidelity: the description must include every visible
 * structural detail so Flux can reproduce the exact garment rather than a generic
 * category approximation. Each category of detail is requested explicitly:
 *   - colour-qualified garment type (warm/cool undertone)
 *   - closure: type, position, hardware
 *   - collar/neckline: exact construction
 *   - pockets: count, type (zip/flap/welt), exact placement (chest/hip/side)
 *   - quilting / channel structure if present
 *   - armhole / sleeve treatment (critical for vests)
 *   - seam lines and panel divisions
 *   - hem and cuff finish
 */
async function describeGarmentFromImage(imageUrl: string, supabaseUserId?: string): Promise<string> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  const result = await openAiClient.createStructuredResponse({
    schema: garmentDescriptionSchema,
    jsonSchema: {
      name: 'garment_description',
      description: 'Construction-detail inventory of a garment for fashion sketch generation',
      schema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description:
              'Comma-separated construction inventory for a sketch artist. Mandatory format: ' +
              '[colour-qualified garment type (warm/cool undertone required)], ' +
              '[closure: type + placement], ' +
              '[collar/neckline: exact construction], ' +
              '[pockets: count + type (zip/flap/welt/patch) + placement for every pocket], ' +
              '[quilting/texture: channel direction and layout if quilted or puffer], ' +
              '[sleeves/armholes: full sleeves OR sleeveless with bound/ribbed armholes], ' +
              '[seams/panels: describe major visible panel lines], ' +
              '[hem + cuff finish]. ' +
              'Include every visible construction detail — omit nothing. ' +
              'Example: "Cool light grey down puffer vest, centre-front zip placket, ' +
              'stand collar with snap closure at top, two horizontal zip chest pockets, ' +
              'two angled zip hip pockets, horizontal quilted baffles across body and shoulders, ' +
              'sleeveless with bound armhole openings, straight hem with no ribbing".',
          },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
    instructions:
      'You are a fashion illustrator producing a technical brief so a sketch artist can reproduce this garment exactly. ' +
      'Inventory every visible construction detail systematically: ' +
      '(1) colour-qualified garment type — lead with colour as an adjective with warm/cool undertone (e.g. "cool grey-taupe" not just "taupe"); ' +
      '(2) closure — zip, button, snap, press-stud, open, with exact placement; ' +
      '(3) collar or neckline — stand, ribbed band, spread, crew, V, etc.; ' +
      '(4) ALL pockets — count them, name type (zip/flap/welt/patch), and locate each one (chest left, chest right, hip, side seam); ' +
      '(5) quilting or texture structure if present — direction of channels, number of rows, baffle shape; ' +
      '(6) sleeves or armholes — full sleeves vs sleeveless, and how armholes are finished; ' +
      '(7) visible seam lines and panel divisions; ' +
      '(8) hem and cuff finish (ribbed, straight, drawcord, raw). ' +
      'Do NOT simplify, generalise, or omit details. The artist must reproduce the garment exactly.',
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      {
        type: 'input_text',
        text:
          'Produce a comma-separated construction inventory of this garment for a sketch artist. ' +
          'Cover: colour (warm/cool undertone), closure, collar, every pocket (count + type + placement), ' +
          'quilting structure if present, sleeves or armholes, panels/seams, hem/cuff finish. ' +
          'Do not omit any visible construction detail.',
      },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });

  return result.description;
}

// Categories where describeGarmentFromImage would hallucinate (non-garment items).
// These are routed to product-only sketch prompts with no mannequin figure.
const ACCESSORY_CATEGORY_KEYWORDS = [
  'sunglass', 'glasses', 'eyewear', 'spectacle',
  'watch', 'timepiece',
  'bag', 'tote', 'backpack', 'briefcase', 'clutch', 'handbag', 'wallet',
  'belt',
  'hat', 'cap', 'beanie', 'fedora', 'beret',
  'jewellery', 'jewelry', 'bracelet', 'necklace', 'ring', 'earring',
  'scarf', 'gloves',
];

function isAccessoryItem(category?: string | null, title?: string | null): boolean {
  const haystack = `${(category ?? '')} ${(title ?? '')}`.toLowerCase();
  return ACCESSORY_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

type SketchOptions = {
  title?: string | null;
  category?: string;
  lensShape?: string | null;
  frameColor?: string | null;
};

async function runSketchGeneration(jobId: string, imageUrl: string, supabaseUserId?: string, options?: SketchOptions) {
  try {
    const isSunglasses = isAccessoryItem(options?.category, options?.title) &&
      `${options?.category ?? ''} ${options?.title ?? ''}`.toLowerCase().includes('sunglass');
    const isAccessory = isAccessoryItem(options?.category, options?.title);

    let prompt: string;
    let additionalNegativePrompt: string | undefined;

    if (isSunglasses) {
      // Sunglasses: build prompt from form fields — skip garment-description vision call
      // which asks about collars/pockets that are irrelevant for eyewear.
      const itemDescription = [
        options?.frameColor ? `${options.frameColor}-frame` : null,
        options?.lensShape ? `${options.lensShape.replace('_', '-')} sunglasses` : 'sunglasses',
      ].filter(Boolean).join(' ');

      prompt = buildSunglassesSketchPrompt({
        itemDescription,
        lensShape: options?.lensShape,
        frameColor: options?.frameColor,
      });
      additionalNegativePrompt = 'person, figure, mannequin, body, hands, face, human, model, dress form, wearing, head, neck, torso, clothing on body';
      logger.info({ jobId, prompt }, 'Closet sunglasses sketch prompt built');
    } else if (isAccessory) {
      // Non-sunglasses accessories (bags, watches, belts, hats, etc.): use a generic
      // product-only prompt built from the item title + category — do NOT run
      // describeGarmentFromImage which would hallucinate a garment from the photo.
      const itemDescription = [options?.title, options?.category].filter(Boolean).join(' ') || 'accessory';
      prompt = buildAccessorySketchPrompt({ itemDescription });
      additionalNegativePrompt = 'person, figure, mannequin, body, hands, face, human, model, dress form, wearing, head, neck, torso, clothing on body';
      logger.info({ jobId, prompt }, 'Closet accessory sketch prompt built');
    } else {
      const itemDescription = await describeGarmentFromImage(imageUrl, supabaseUserId);
      logger.info({ jobId, itemDescription }, 'Closet sketch description produced');
      prompt = buildClosetItemSketchPrompt({ itemDescription });
    }

    const generatedImage = await imageGenerationClient.generateImage({
      prompt,
      loraType: 'closet',
      itemType: isAccessory ? 'accessory' : 'garment',
      // Accessories use product-only mode — skip img2img so the background/environment
      // from the source photo doesn't pollute the clean product sketch.
      sourceImageUrl: isAccessory ? undefined : (imageUrl.startsWith('https://') ? imageUrl : undefined),
      supabaseUserId,
      additionalNegativePrompt,
    });

    // Store image data in DB only (not on the ephemeral filesystem) so sketches
    // survive server restarts. The /media/closet-sketch/:filename handler serves
    // directly from this DB record.
    const storageKey = `closet-sketch/${jobId}.jpg`;
    const sketchImageUrl = `${storageConfig.publicBaseUrl}/media/${storageKey}`;

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchImageUrl,
      sketchStorageKey: storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
  } catch (error) {
    logger.error({ jobId, error }, 'Closet item sketch generation failed');
    await closetRepository.updateSketchJob(jobId, {
      status: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
    });
  }
}

export const closetSketchService = {
  async startSketchJob(imageUrl: string, supabaseUserId?: string, options?: SketchOptions): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void runSketchGeneration(job.id, imageUrl, supabaseUserId, options);
    return job.id;
  },

  async getSketchJobStatus(jobId: string) {
    const job = await closetRepository.getSketchJob(jobId);
    if (!job) return null;
    return {
      sketchStatus: job.status as 'pending' | 'ready' | 'failed',
      sketchImageUrl: job.sketchImageUrl ?? null,
    };
  },
};
