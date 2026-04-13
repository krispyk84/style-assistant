import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { FAL_FLUX_LORA_COST_USD, FAL_FLUX2PRO_COST_USD } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';
import { submitToQueue, pollUntilDone } from './fal-queue-client.js';
import { buildFalRequestParams } from './fal-prompt-builder.js';
import { buildImg2ImgParams } from './fal-style-reference-handler.js';

export type { GenerateImageInput } from './fal-types.js';

const FLUX_LORA_MODEL_ID = 'fal-ai/flux-lora';

async function downloadImage(imageUrl: string): Promise<{ mimeType: string; data: Buffer }> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new HttpError(502, 'FAL_IMAGE_DOWNLOAD_FAILED', 'Could not download the generated sketch image.');
  }
  return {
    mimeType: imageResponse.headers.get('content-type') ?? 'image/jpeg',
    data: Buffer.from(await imageResponse.arrayBuffer()),
  };
}

export const falClient = {
  async generateImage(input: import('./fal-types.js').GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const startMs = Date.now();

    // ── Outfit sketches: Flux 2 Pro (no LoRA, no negative prompt, no inference steps) ──
    if (input.loraType === 'outfit') {
      const modelId = env.FAL_OUTFIT_SKETCH_MODEL;
      logger.info(
        { provider: 'fal', model: modelId, loraType: 'outfit', prompt: input.prompt },
        'fal.ai outfit sketch generation starting'
      );

      try {
        const requestId = await submitToQueue(
          {
            prompt: input.prompt,
            image_size: { width: 768, height: 1024 },
            num_images: 1,
          },
          modelId,
        );

        logger.info({ requestId, model: modelId, provider: 'fal' }, 'fal.ai outfit job queued, polling');

        const result = await pollUntilDone(requestId, modelId);
        const imageUrl: unknown = (result as any)?.images?.[0]?.url;
        const contentType: string = (result as any)?.images?.[0]?.content_type ?? 'image/jpeg';

        if (typeof imageUrl !== 'string' || !imageUrl) {
          logger.error({ result, model: modelId }, 'flux-2-pro result missing image URL');
          throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
        }

        const latencyMs = Date.now() - startMs;
        logger.info({ requestId, provider: 'fal', model: modelId, latencyMs }, 'fal.ai outfit sketch completed');

        if (input.supabaseUserId) {
          usageService.record({
            supabaseUserId: input.supabaseUserId,
            feature: 'outfit-sketch',
            model: modelId,
            costUsd: FAL_FLUX2PRO_COST_USD,
          });
        }

        return await downloadImage(imageUrl);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        logger.error({ error, model: modelId }, 'Unexpected fal.ai flux-2-pro failure');
        throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
      }
    }

    // ── Closet sketches: existing Flux LoRA path (unchanged) ──────────────────────────
    const { fullPrompt, negativePrompt, loraUrl, guidanceScale, loraScale } = buildFalRequestParams(input);
    const { params: img2imgParams, styleRefUsed } = buildImg2ImgParams(input);

    logger.info(
      { provider: 'fal', model: FLUX_LORA_MODEL_ID, loraType: input.loraType, prompt: fullPrompt, styleRefUsed, fallbackUsed: false },
      'fal.ai sketch generation starting'
    );

    try {
      const requestId = await submitToQueue(
        {
          prompt: fullPrompt,
          negative_prompt: negativePrompt,
          loras: [{ path: loraUrl, scale: loraScale }],
          image_size: { width: 1024, height: 1365 },
          num_inference_steps: 28,
          guidance_scale: guidanceScale,
          num_images: 1,
          ...img2imgParams,
        },
        FLUX_LORA_MODEL_ID,
      );

      logger.info({ requestId, loraType: input.loraType, provider: 'fal' }, 'fal.ai job queued, polling');

      const result = await pollUntilDone(requestId, FLUX_LORA_MODEL_ID);
      const imageUrl: unknown = (result as any)?.images?.[0]?.url;
      const contentType: string = (result as any)?.images?.[0]?.content_type ?? 'image/jpeg';

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ result, loraType: input.loraType }, 'flux-lora result missing image URL');
        throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
      }

      const latencyMs = Date.now() - startMs;
      logger.info({ requestId, provider: 'fal', loraType: input.loraType, latencyMs, styleRefUsed, fallbackUsed: false }, 'fal.ai sketch completed');

      if (input.supabaseUserId) {
        usageService.record({
          supabaseUserId: input.supabaseUserId,
          feature: 'closet-sketch',
          model: FLUX_LORA_MODEL_ID,
          costUsd: FAL_FLUX_LORA_COST_USD,
        });
      }

      return {
        mimeType: contentType,
        data: Buffer.from(await (await fetch(imageUrl)).arrayBuffer()),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error({ error, loraType: input.loraType }, 'Unexpected fal.ai flux-lora failure');
      throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
    }
  },
};
