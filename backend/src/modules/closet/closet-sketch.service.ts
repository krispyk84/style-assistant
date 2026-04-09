import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { openAiClient } from '../../ai/openai-client.js';
import { falClient } from '../../ai/fal-client.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
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

async function runSketchGeneration(jobId: string, imageUrl: string, supabaseUserId?: string) {
  try {
    const itemDescription = await describeGarmentFromImage(imageUrl, supabaseUserId);

    logger.info({ jobId, itemDescription }, 'Closet sketch description produced');

    const generatedImage = await falClient.generateImage({
      prompt: buildClosetItemSketchPrompt({ itemDescription }),
      loraType: 'closet',
      // Pass the original upload URL as img2img source when it is a public https URL
      // (i.e. production S3/R2). Flux uses this at strength=0.45 to inherit the
      // garment's structural geometry while still applying the LoRA style.
      // Skipped for localhost / local storage (not reachable by fal.ai).
      sourceImageUrl: imageUrl.startsWith('https://') ? imageUrl : undefined,
      supabaseUserId,
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
  async startSketchJob(imageUrl: string, supabaseUserId?: string): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void runSketchGeneration(job.id, imageUrl, supabaseUserId);
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
