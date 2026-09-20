import { openAiClient } from '../../ai/openai-client.js';
import { resolveImageUrlForAI } from '../../ai/image-input.js';
import { env } from '../../config/env.js';
import { storageConfig } from '../../config/storage.js';
import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import {
  buildFragranceBottleDescriptionJsonSchema,
  buildFragranceSketchPrompt,
  BOTTLE_DESCRIPTION_PROMPT,
  fragranceBottleDescriptionSchema,
  type FragranceBottleDescription,
} from '../../ai/prompts/fragrance-sketch.prompts.js';
import { closetRepository } from '../closet/closet.repository.js';

// ── Fragrance bottle sketch generation ───────────────────────────────────────
//
// Deliberately reuses ClosetSketchJob/closetRepository's existing generic job
// table and the existing /media/closet-sketch/:filename route as-is (see
// schema.prisma's UserFragrance.bottleSketchUrl comment) — the job table has
// no category-specific fields, so no new table or route is needed, only a
// different prompt. Mirrors closet-sketch.service.ts's async job/poll
// structure exactly, with a fragrance-specific vision-description step (only
// when an image is available) feeding a fragrance-specific sketch prompt
// instead of the garment one.

type SketchInput = {
  brand: string;
  name: string;
  concentration?: string | null;
  imageUrl?: string | null;
};

async function describeBottleFromImage(imageUrl: string, supabaseUserId?: string): Promise<FragranceBottleDescription | null> {
  const imageBlock = await resolveImageUrlForAI(imageUrl);
  if (!imageBlock) return null;

  return openAiClient.createStructuredResponse({
    schema: fragranceBottleDescriptionSchema,
    jsonSchema: buildFragranceBottleDescriptionJsonSchema(),
    instructions: BOTTLE_DESCRIPTION_PROMPT.instructions,
    userContent: [imageBlock, { type: 'input_text', text: BOTTLE_DESCRIPTION_PROMPT.userText }],
    supabaseUserId,
    feature: 'fragrance-describe',
  });
}

async function generateFragranceBottleSketch(jobId: string, input: SketchInput, supabaseUserId?: string): Promise<void> {
  // A failed/unavailable image never blocks the sketch attempt — falls
  // through to buildFragranceSketchPrompt's no-description branch, which
  // renders a tasteful generic bottle for the identity instead.
  const description = input.imageUrl ? await describeBottleFromImage(input.imageUrl, supabaseUserId).catch(() => null) : null;

  const prompt = buildFragranceSketchPrompt({
    brand: input.brand,
    name: input.name,
    concentration: input.concentration,
    description,
  });

  const generatedImage = await openAiClient.generateImage({
    prompt,
    model: env.OPENAI_OUTFIT_SKETCH_MODEL,
    size: '1024x1024',
    quality: env.OPENAI_OUTFIT_SKETCH_QUALITY,
    outputFormat: 'jpeg',
    supabaseUserId,
    feature: 'fragrance-sketch',
    logContext: { jobId },
  });

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

async function runSketchJob(jobId: string, input: SketchInput, supabaseUserId?: string) {
  try {
    await generateFragranceBottleSketch(jobId, input, supabaseUserId);
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ jobId, errorCode: code, error }, 'Fragrance bottle sketch generation failed');
    await closetRepository.updateSketchJob(jobId, {
      status: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
      sketchErrorCode: code,
      sketchErrorMessage: message,
    });
  }
}

export const fragranceSketchService = {
  async startSketchJob(input: SketchInput, supabaseUserId?: string): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void runSketchJob(job.id, input, supabaseUserId);
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
