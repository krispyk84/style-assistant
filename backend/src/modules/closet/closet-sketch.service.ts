import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import type { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { env } from '../../config/env.js';
import { openAiClient } from '../../ai/openai-client.js';
import { OPENAI_MINI_OUTFIT_SKETCH_COST_USD } from '../../ai/costs.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/closet-item-sketch.prompts.js';
import type { ClosetItemSketchInput } from '../../ai/prompts/closet-item-sketch.prompts.js';
import {
  FOOTWEAR_DESCRIPTION_INSTRUCTIONS,
  FOOTWEAR_DESCRIPTION_JSON_SCHEMA,
  FOOTWEAR_DESCRIPTION_USER_TEXT,
  GARMENT_DESCRIPTION_INSTRUCTIONS,
  GARMENT_DESCRIPTION_JSON_SCHEMA,
  GARMENT_DESCRIPTION_USER_TEXT,
} from '../../ai/prompts/closet-vision.prompts.js';
import { closetRepository } from './closet.repository.js';
import { enhancedGarmentDescriptionSchema, footwearDescriptionSchema } from './closet.schemas.js';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING
//
//   generateClosetItemSketch  →  OpenAI gpt-image-1  (this file)
//   generateOutfitSketch      →  fal.ai Flux-LoRA    (tier-sketch.service.ts)
//
// Do NOT add fal.ai calls here. Do NOT add OpenAI image calls to tier-sketch.
// ─────────────────────────────────────────────────────────────────────────────

// ── Category routing keywords ─────────────────────────────────────────────────

const FOOTWEAR_CATEGORY_KEYWORDS = [
  'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'loafer', 'loafers',
  'oxford', 'derby', 'brogue', 'chelsea', 'monk', 'mule', 'sandal', 'sandals',
  'slipper', 'trainer', 'trainers', 'runner', 'runners', 'footwear',
  'heel', 'heels', 'pump', 'pumps', 'espadrille',
];

const ACCESSORY_CATEGORY_KEYWORDS = [
  'sunglass', 'glasses', 'eyewear', 'spectacle',
  'watch', 'timepiece',
  'bag', 'tote', 'backpack', 'briefcase', 'clutch', 'handbag', 'wallet',
  'belt',
  'hat', 'cap', 'beanie', 'fedora', 'beret',
  'jewellery', 'jewelry', 'bracelet', 'necklace', 'ring', 'earring',
  'scarf', 'gloves',
];

function isFootwearItem(category?: string | null, title?: string | null): boolean {
  const haystack = `${category ?? ''} ${title ?? ''}`.toLowerCase();
  return FOOTWEAR_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

function isAccessoryItem(category?: string | null, title?: string | null): boolean {
  const haystack = `${category ?? ''} ${title ?? ''}`.toLowerCase();
  return ACCESSORY_CATEGORY_KEYWORDS.some((kw) => haystack.includes(kw));
}

// ── Image utility ─────────────────────────────────────────────────────────────

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

// ── Footwear vision analysis ───────────────────────────────────────────────────

async function describeFootwearFromImage(
  imageUrl: string,
  supabaseUserId?: string,
): Promise<z.infer<typeof footwearDescriptionSchema>> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);
  return openAiClient.createStructuredResponse({
    schema: footwearDescriptionSchema,
    jsonSchema: FOOTWEAR_DESCRIPTION_JSON_SCHEMA,
    instructions: FOOTWEAR_DESCRIPTION_INSTRUCTIONS,
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      { type: 'input_text', text: FOOTWEAR_DESCRIPTION_USER_TEXT },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });
}

// ── Enhanced garment vision analysis ─────────────────────────────────────────

async function describeGarmentFromImage(
  imageUrl: string,
  supabaseUserId?: string,
): Promise<z.infer<typeof enhancedGarmentDescriptionSchema>> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);
  return openAiClient.createStructuredResponse({
    schema: enhancedGarmentDescriptionSchema,
    jsonSchema: GARMENT_DESCRIPTION_JSON_SCHEMA,
    instructions: GARMENT_DESCRIPTION_INSTRUCTIONS,
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      { type: 'input_text', text: GARMENT_DESCRIPTION_USER_TEXT },
    ],
    supabaseUserId,
    feature: 'closet-describe',
  });
}

// ── Build must-preserve block for sketch input ────────────────────────────────

function buildMustPreserveFromFootwear(
  shoe: z.infer<typeof footwearDescriptionSchema>,
): string[] {
  // Deduplicate and filter empty
  const candidates = [
    shoe.vampConstruction,
    shoe.toeShape,
    shoe.soleProfile,
    shoe.stitchingDetails,
    shoe.fasteningSystem,
    shoe.upperPaneling !== 'clean single-piece upper with minimal seaming' ? shoe.upperPaneling : null,
    shoe.hardwareDetails !== 'none' && shoe.hardwareDetails !== 'no hardware' ? shoe.hardwareDetails : null,
    shoe.distinctiveFeatures,
    ...shoe.mustPreserve,
  ].filter((v): v is string => v != null && v.length > 3);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return candidates
    .filter((s) => { const lower = s.toLowerCase(); if (seen.has(lower)) return false; seen.add(lower); return true; })
    .slice(0, 6);
}

// ── Sketch options ─────────────────────────────────────────────────────────────

type SketchOptions = {
  title?: string | null;
  category?: string;
  lensShape?: string | null;
  frameColor?: string | null;
};

// ── Main sketch generation ─────────────────────────────────────────────────────

async function generateClosetItemSketch(
  jobId: string,
  imageUrl: string,
  supabaseUserId?: string,
  options?: SketchOptions,
): Promise<void> {
  const category = options?.category ?? '';
  const title = options?.title ?? '';

  const isFootwear = isFootwearItem(category, title);
  const isAccessory = !isFootwear && isAccessoryItem(category, title);
  const isSunglasses = isAccessory &&
    `${category} ${title}`.toLowerCase().includes('sunglass');

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

  } else if (isFootwear) {
    const shoe = await describeFootwearFromImage(imageUrl, supabaseUserId);
    logger.info({ jobId, shoe }, 'Closet sketch: footwear description produced');

    const mustPreserve = buildMustPreserveFromFootwear(shoe);

    sketchInput = {
      category: 'footwear',
      type: shoe.type,
      color: shoe.color,
      colorDetails: shoe.colorDetails,
      material: shoe.primaryMaterial,
      secondaryMaterials: shoe.secondaryMaterials,
      silhouette: shoe.silhouetteProfile,
      toeShape: shoe.toeShape,
      vampConstruction: shoe.vampConstruction,
      fasteningSystem: shoe.fasteningSystem,
      soleProfile: shoe.soleProfile,
      heelType: shoe.heelType,
      upperPaneling: shoe.upperPaneling,
      stitchingDetails: shoe.stitchingDetails,
      hardwareDetails: shoe.hardwareDetails !== 'none' && shoe.hardwareDetails !== 'no hardware' ? shoe.hardwareDetails : undefined,
      distinctiveFeatures: shoe.distinctiveFeatures,
      brandLanguage: shoe.brandLanguage,
      stylingNotes: shoe.stylingNotes,
      mustPreserve,
    };
    size = '1024x1024'; // Square is better for isolated shoe renders

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
      constructionDetails: garment.constructionDetails,
      standoutFeatures: garment.standoutFeatures,
      stylingNotes: garment.stylingNotes,
      mustPreserve: garment.mustPreserve,
    };
    size = '1024x1536';
  }

  const prompt = buildClosetItemSketchPrompt(sketchInput);
  logger.debug({ jobId, promptLength: prompt.length, mustPreserveCount: sketchInput.mustPreserve?.length ?? 0 }, 'Closet sketch: prompt built');

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
