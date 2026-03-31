import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type GenerateImageInput = {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
};

function parseSize(size: string | undefined): { width: number; height: number } {
  if (!size || size === 'auto') return { width: 1024, height: 1536 };
  const [w, h] = size.split('x').map(Number);
  return { width: w ?? 1024, height: h ?? 1536 };
}

function qualityToSteps(quality: string | undefined): number {
  if (quality === 'low') return 20;
  if (quality === 'high') return 35;
  return 28; // medium / default
}

export const falClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

    try {
      const imageSize = parseSize(input.size);
      const numSteps = qualityToSteps(input.quality);
      const outputFormat = input.outputFormat ?? 'jpeg';

      const response = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Key ${env.FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.prompt,
          image_size: imageSize,
          num_images: 1,
          output_format: outputFormat,
          num_inference_steps: numSteps,
          guidance_scale: 3.5,
          enable_safety_checker: false,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        logger.error(
          {
            statusCode: response.status,
            error: payload?.detail ?? payload?.error ?? 'Unknown fal.ai error',
          },
          'fal.ai image generation failed'
        );
        throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider could not generate the sketch.');
      }

      const imageUrl = payload?.images?.[0]?.url;
      const contentType = payload?.images?.[0]?.content_type ?? `image/${outputFormat}`;

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ payload }, 'fal.ai image generation response did not include image URL');
        throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
      }

      // Download the image from the returned URL
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
        logger.error('fal.ai image request timed out');
        throw new HttpError(504, 'FAL_IMAGE_TIMEOUT', 'The AI provider timed out while generating the sketch.');
      }

      logger.error({ error }, 'Unexpected fal.ai image generation failure');
      throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
    } finally {
      clearTimeout(timeout);
    }
  },
};
