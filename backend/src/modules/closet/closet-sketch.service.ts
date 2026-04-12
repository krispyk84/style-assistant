import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildAccessorySketchPrompt, buildClosetItemSketchPrompt, buildSunglassesOpenAiPrompt } from '../../ai/prompts/sketch.prompts.js';
import { closetRepository } from './closet.repository.js';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING
//
//   generateClosetItemSketch  →  OpenAI gpt-image-1  (this file)
//   generateOutfitSketch      →  fal.ai Flux-LoRA    (tier-sketch.service.ts)
//
// Do NOT add fal.ai calls here. Do NOT add OpenAI image calls to tier-sketch.
// ─────────────────────────────────────────────────────────────────────────────

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

async function describeGarmentFromImage(imageUrl: string, supabaseUserId?: string): Promise<string> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  const result = await openAiClient.createStructuredResponse({
    schema: garmentDescriptionSchema,
    jsonSchema: {
      name: 'garment_description',
      description: 'A concise but detailed description of the garment in the image',
      schema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A detailed description of the garment including colour, fabric, style, and key visual details. 1–2 sentences max.',
          },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
    instructions: 'You are a menswear expert. Describe the garment shown in the image concisely and accurately.',
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      { type: 'input_text', text: 'Describe this garment in detail: colour, fabric, style, and key visual features.' },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });

  return result.description;
}

// Categories where describeGarmentFromImage would hallucinate (non-garment items).
// These are routed to product-only prompts built from form fields instead.
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
  const haystack = `${category ?? ''} ${title ?? ''}`.toLowerCase();
  return ACCESSORY_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

type SketchOptions = {
  title?: string | null;
  category?: string;
  lensShape?: string | null;
  frameColor?: string | null;
};

async function generateClosetItemSketch(
  jobId: string,
  imageUrl: string,
  supabaseUserId?: string,
  options?: SketchOptions,
): Promise<void> {
  const isAccessory = isAccessoryItem(options?.category, options?.title);
  const isSunglasses = isAccessory &&
    `${options?.category ?? ''} ${options?.title ?? ''}`.toLowerCase().includes('sunglass');

  let prompt: string;
  let size: '1024x1024' | '1024x1536';

  if (isSunglasses) {
    const itemDescription = [
      options?.frameColor ? `${options.frameColor}-frame` : null,
      options?.lensShape ? `${options.lensShape.replace('_', '-')} sunglasses` : 'sunglasses',
    ].filter(Boolean).join(' ');
    prompt = buildSunglassesOpenAiPrompt({ itemDescription, lensShape: options?.lensShape, frameColor: options?.frameColor });
    size = '1024x1024';
    logger.info({ jobId, prompt }, 'Closet sketch: sunglasses prompt built');
  } else if (isAccessory) {
    const itemDescription = [options?.title, options?.category].filter(Boolean).join(' ') || 'accessory';
    prompt = buildAccessorySketchPrompt({ itemDescription });
    size = '1024x1024';
    logger.info({ jobId, prompt }, 'Closet sketch: accessory prompt built');
  } else {
    const itemDescription = await describeGarmentFromImage(imageUrl, supabaseUserId);
    logger.info({ jobId, itemDescription }, 'Closet sketch: garment description produced');
    prompt = buildClosetItemSketchPrompt({ itemDescription });
    size = '1024x1536';
  }

  const generatedImage = await openAiClient.generateImage({
    prompt,
    size,
    quality: 'medium',
    outputFormat: 'jpeg',
    supabaseUserId,
    feature: 'closet-sketch',
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
}

async function runSketchJob(jobId: string, imageUrl: string, supabaseUserId?: string, options?: SketchOptions) {
  try {
    await generateClosetItemSketch(jobId, imageUrl, supabaseUserId, options);
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
    void runSketchJob(job.id, imageUrl, supabaseUserId, options);
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
