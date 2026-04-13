import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { env } from '../../config/env.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import type { ClosetItemSketchInput } from '../../ai/prompts/sketch.prompts.js';
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
  type: z.string(),
  color: z.string(),
  material: z.string(),
  silhouette: z.string(),
  details: z.string(),
  stylingNotes: z.string(),
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

async function describeGarmentFromImage(imageUrl: string, supabaseUserId?: string): Promise<z.infer<typeof garmentDescriptionSchema>> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  return openAiClient.createStructuredResponse({
    schema: garmentDescriptionSchema,
    jsonSchema: {
      name: 'garment_description',
      description: 'Structured description of the garment for a fashion illustration prompt',
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Specific garment type, e.g. "slim-fit chino trousers", "crewneck sweater", "chelsea boots"' },
          color: { type: 'string', description: 'Exact color with undertone and depth, e.g. "dark navy", "warm camel", "off-white cream"' },
          material: { type: 'string', description: 'Fabric or material with finish, e.g. "soft brushed cotton twill", "full-grain leather with rubber sole"' },
          silhouette: { type: 'string', description: 'Shape and fit description, e.g. "slim tapered leg with mid-rise waist"' },
          details: { type: 'string', description: 'Key construction details visible: seams, stitching, hardware, pockets, collar, cuff, zipper, sole, etc.' },
          stylingNotes: { type: 'string', description: 'Overall aesthetic impression: tone, finish, mood, e.g. "refined, well-pressed, matte finish"' },
        },
        required: ['type', 'color', 'material', 'silhouette', 'details', 'stylingNotes'],
        additionalProperties: false,
      },
    },
    instructions: 'You are a menswear expert. Extract precise structured details from the garment image for use in a fashion illustration prompt.',
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      { type: 'input_text', text: 'Describe this garment in structured detail for a fashion sketch prompt: type, exact color, material, silhouette, construction details, and styling notes.' },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });
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

  let sketchInput: ClosetItemSketchInput;
  let size: '1024x1024' | '1024x1536';

  if (isSunglasses) {
    const lensShape = options?.lensShape?.replace('_', '-') ?? null;
    const frameColor = options?.frameColor ?? null;
    sketchInput = {
      category: 'sunglasses',
      type: [frameColor ? `${frameColor}-frame` : null, lensShape ? `${lensShape} lens` : null, 'sunglasses'].filter(Boolean).join(' '),
      color: frameColor ?? 'as shown',
      details: 'frame shape, lens tint, hinge placement, arm structure, bridge width',
      orientation: 'front-facing at a slight angle so both lenses and the full frame are clearly visible',
    };
    size = '1024x1024';
    logger.info({ jobId, sketchInput }, 'Closet sketch: sunglasses input built');
  } else if (isAccessory) {
    sketchInput = {
      category: options?.category ?? 'accessory',
      type: options?.title ?? options?.category ?? 'accessory',
      color: 'as shown',
      details: 'hardware, stitching, structure, material finish, edge treatment',
      orientation: 'isolated, product centered, slight 3-quarter angle to show depth',
    };
    size = '1024x1024';
    logger.info({ jobId, sketchInput }, 'Closet sketch: accessory input built');
  } else {
    const garment = await describeGarmentFromImage(imageUrl, supabaseUserId);
    logger.info({ jobId, garment }, 'Closet sketch: garment description produced');
    sketchInput = {
      category: options?.category ?? 'garment',
      type: garment.type,
      color: garment.color,
      material: garment.material,
      silhouette: garment.silhouette,
      details: garment.details,
      stylingNotes: garment.stylingNotes,
    };
    size = '1024x1536';
  }

  const prompt = buildClosetItemSketchPrompt(sketchInput);

  const generatedImage = await openAiClient.generateImage({
    prompt,
    model: env.OPENAI_OUTFIT_SKETCH_MODEL,
    size,
    quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
    outputFormat: 'jpeg',
    supabaseUserId,
    feature: 'closet-sketch',
    costUsd: OPENAI_MINI_OUTFIT_SKETCH_COST_USD,
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
