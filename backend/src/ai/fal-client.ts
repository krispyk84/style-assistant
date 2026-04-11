import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { FAL_FLUX_LORA_COST_USD } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';
import { submitToQueue, pollUntilDone } from './fal-queue-client.js';
import { buildFalRequestParams } from './fal-prompt-builder.js';
import { buildImg2ImgParams } from './fal-style-reference-handler.js';

export type { GenerateImageInput } from './fal-types.js';

export const falClient = {
  async generateImage(input: import('./fal-types.js').GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const { fullPrompt, negativePrompt, loraUrl, guidanceScale, loraScale } = buildFalRequestParams(input);
    const { params: img2imgParams, styleRefUsed } = buildImg2ImgParams(input);

    const startMs = Date.now();
    logger.info(
      { provider: 'fal', loraType: input.loraType, prompt: fullPrompt, styleRefUsed, fallbackUsed: false },
      'fal.ai sketch generation starting'
    );

    try {
      const requestId = await submitToQueue({
        prompt: fullPrompt,
        negative_prompt: negativePrompt,
        loras: [{ path: loraUrl, scale: loraScale }],
        image_size: { width: 1024, height: 1365 },
        num_inference_steps: 28,
        guidance_scale: guidanceScale,
        num_images: 1,
        ...img2imgParams,
      });

      logger.info({ requestId, loraType: input.loraType, provider: 'fal' }, 'fal.ai job queued, polling');

      const result = await pollUntilDone(requestId);
      const imageUrl: unknown = (result as any)?.images?.[0]?.url;
      const contentType: string = (result as any)?.images?.[0]?.content_type ?? 'image/jpeg';

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ result, loraType: input.loraType }, 'flux-lora result missing image URL');
        throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
      }

      const latencyMs = Date.now() - startMs;
      logger.info({ requestId, provider: 'fal', loraType: input.loraType, latencyMs, styleRefUsed, fallbackUsed: false }, 'fal.ai sketch completed');

      // Download the image from the fal.ai CDN
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new HttpError(502, 'FAL_IMAGE_DOWNLOAD_FAILED', 'Could not download the generated sketch image.');
      }
      const arrayBuffer = await imageResponse.arrayBuffer();

      if (input.supabaseUserId) {
        usageService.record({
          supabaseUserId: input.supabaseUserId,
          feature: input.loraType === 'closet' ? 'closet-sketch' : 'outfit-sketch',
          model: 'fal-ai/flux-lora',
          costUsd: FAL_FLUX_LORA_COST_USD,
        });
      }

      return {
        mimeType: contentType,
        data: Buffer.from(arrayBuffer),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error({ error, loraType: input.loraType }, 'Unexpected fal.ai flux-lora failure');
      throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
    }
  },
};
