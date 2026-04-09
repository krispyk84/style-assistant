import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type GenerateImageInput = {
  prompt: string;
  loraType: 'closet' | 'outfit';
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
};

export const falClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const isCloset = input.loraType === 'closet';
    const loraUrl = isCloset ? env.CLOSET_LORA_URL : env.OUTFIT_LORA_URL;
    const triggerWord = isCloset ? 'VESTURE_ITEM' : 'VESTURE_OUTFIT';
    const fullPrompt = `${triggerWord}, ${input.prompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch('https://fal.run/fal-ai/flux-lora', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          loras: [{ path: loraUrl, scale: 1.0 }],
          image_size: 'portrait_4_3',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        logger.error(
          {
            statusCode: response.status,
            loraType: input.loraType,
            error: payload?.detail ?? payload?.error ?? 'Unknown flux-lora error',
          },
          'fal.ai flux-lora image generation failed'
        );
        throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider could not generate the sketch.');
      }

      const imageUrl = payload?.images?.[0]?.url;
      const contentType = payload?.images?.[0]?.content_type ?? 'image/jpeg';

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ payload, loraType: input.loraType }, 'flux-lora response did not include image URL');
        throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
      }

      // Download the image from the returned CDN URL
      const imageResponse = await fetch(imageUrl, { signal: controller.signal });
      if (!imageResponse.ok) {
        throw new HttpError(502, 'FAL_IMAGE_DOWNLOAD_FAILED', 'Could not download the generated sketch image.');
      }
      const arrayBuffer = await imageResponse.arrayBuffer();

      return {
        mimeType: contentType,
        data: Buffer.from(arrayBuffer),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ loraType: input.loraType }, 'fal.ai flux-lora request timed out');
        throw new HttpError(504, 'FAL_IMAGE_TIMEOUT', 'The AI provider timed out while generating the sketch.');
      }

      logger.error({ error, loraType: input.loraType }, 'Unexpected fal.ai flux-lora failure');
      throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
    } finally {
      clearTimeout(timeout);
    }
  },
};
