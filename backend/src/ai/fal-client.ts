import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type GenerateImageInput = {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
};

function sizeToAspectRatio(size: string | undefined): string {
  if (!size || size === 'auto' || size === '1024x1536') return 'ASPECT_2_3';
  if (size === '1024x1024') return 'ASPECT_1_1';
  if (size === '1536x1024') return 'ASPECT_3_2';
  return 'ASPECT_2_3';
}

function qualityToModel(quality: string | undefined): string {
  return quality === 'low' ? 'V_2_TURBO' : 'V_2';
}

export const falClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch('https://fal.run/fal-ai/ideogram/v2', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Key ${env.FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.prompt,
          aspect_ratio: sizeToAspectRatio(input.size),
          model: qualityToModel(input.quality),
          style_type: 'ILLUSTRATION',
          magic_prompt_option: 'OFF',
          negative_prompt: 'photorealistic, photograph, 3D render, CGI, text, watermark, logo, busy background',
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        logger.error(
          {
            statusCode: response.status,
            error: payload?.detail ?? payload?.error ?? 'Unknown Ideogram error',
          },
          'Ideogram v2 image generation failed'
        );
        throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider could not generate the sketch.');
      }

      const imageUrl = payload?.images?.[0]?.url;
      const contentType = payload?.images?.[0]?.content_type ?? 'image/jpeg';

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ payload }, 'Ideogram v2 response did not include image URL');
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
        logger.error('Ideogram v2 image request timed out');
        throw new HttpError(504, 'FAL_IMAGE_TIMEOUT', 'The AI provider timed out while generating the sketch.');
      }

      logger.error({ error }, 'Unexpected Ideogram v2 image generation failure');
      throw new HttpError(502, 'FAL_IMAGE_UNAVAILABLE', 'The AI provider is currently unavailable for sketches.');
    } finally {
      clearTimeout(timeout);
    }
  },
};
