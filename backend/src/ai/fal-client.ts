import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { FAL_FLUX_LORA_COST_USD } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';

export type GenerateImageInput = {
  prompt: string;
  loraType: 'closet' | 'outfit';
  /**
   * Optional publicly-accessible URL of the source garment image.
   * When provided the generation runs in img2img mode: Flux starts from
   * a partially-noised version of the source image (strength ~0.45) so the
   * output inherits the garment's structural geometry while the LoRA still
   * applies the Vesture illustration style.
   *
   * Only pass URLs that are reachable by fal.ai — i.e. public https:// URLs
   * (S3 / R2 in production). Skip for localhost / local storage.
   */
  sourceImageUrl?: string;
  supabaseUserId?: string;
  /**
   * Optional anchor-category-specific drift suppression terms.
   * Appended to the base NEGATIVE_PROMPT so the model cannot substitute a
   * tier-appropriate archetype for the user's actual anchor item category.
   * Example: "blazer, suit jacket, field jacket" when anchor is a bomber jacket.
   */
  additionalNegativePrompt?: string;
};

const NEGATIVE_PROMPT =
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, product photography, studio photo, digital painting, oil painting, anime, cartoon, flat lay, flatlay, lookbook, clothing hanger, product display, clothes folded, styled flat, cropped at knees, cropped at ankles, cut-off feet, shoes cut off, partial legs, incomplete figure, torso only';

const QUEUE_BASE = 'https://queue.fal.run/fal-ai/flux-lora';
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // 40 × 3 s = 120 s max

async function submitToQueue(body: object): Promise<string> {
  const res = await fetch(QUEUE_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    logger.error({ statusCode: res.status, error: data?.detail ?? data?.error }, 'fal.ai queue submission failed');
    throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider could not start sketch generation.');
  }

  const requestId: string = data?.request_id;
  if (!requestId) {
    logger.error({ data }, 'fal.ai queue response missing request_id');
    throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid queue response.');
  }

  return requestId;
}

async function pollUntilDone(requestId: string): Promise<unknown> {
  const statusUrl = `${QUEUE_BASE}/requests/${requestId}/status`;
  const resultUrl = `${QUEUE_BASE}/requests/${requestId}`;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${env.FAL_KEY}` },
    });

    const statusData = await statusRes.json().catch(() => null);
    const status: string = statusData?.status ?? '';

    if (status === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${env.FAL_KEY}` },
      });
      const result = await resultRes.json().catch(() => null);
      return result;
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      logger.error({ requestId, status, logs: statusData?.logs }, 'fal.ai flux-lora job failed');
      throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider sketch generation failed.');
    }

    // IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new HttpError(504, 'FAL_IMAGE_TIMEOUT', 'The AI provider timed out while generating the sketch.');
}

export const falClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const isCloset = input.loraType === 'closet';
    const loraUrl = isCloset ? env.CLOSET_LORA_URL : env.OUTFIT_LORA_URL;
    const triggerWord = isCloset ? 'VESTURE_ITEM' : 'VESTURE_OUTFIT';
    const fullPrompt = `${triggerWord}, ${input.prompt}`;

    const img2imgMode = input.sourceImageUrl?.startsWith('https://') ?? false;
    const startMs = Date.now();
    logger.info({ loraType: input.loraType, prompt: fullPrompt, img2imgMode }, 'fal.ai sketch generation starting');

    const img2imgParams =
      input.sourceImageUrl && input.sourceImageUrl.startsWith('https://')
        ? { image_url: input.sourceImageUrl, strength: 0.45 }
        : {};

    // Append anchor-category drift suppression to the base negative prompt so the
    // model cannot substitute a tier-appropriate archetype (e.g. blazer for bomber).
    const negativePrompt = input.additionalNegativePrompt
      ? `${NEGATIVE_PROMPT}, ${input.additionalNegativePrompt}`
      : NEGATIVE_PROMPT;

    // Outfit sketches need higher guidance and lower LoRA scale so the anchor
    // description overrides the LoRA's tier-archetype priors (e.g. "business = blazer").
    // guidance_scale 6.0 forces strict prompt adherence; LoRA scale 0.75 reduces the
    // LoRA's garment-archetype influence while keeping the illustration style.
    // Closet single-item sketches keep 3.5 / 0.9 for maximum style fidelity.
    const guidanceScale = isCloset ? 3.5 : 6.0;
    const loraScale = isCloset ? 0.9 : 0.75;

    try {
      const requestId = await submitToQueue({
        prompt: fullPrompt,
        negative_prompt: negativePrompt,
        loras: [{ path: loraUrl, scale: loraScale }],
        image_size: 'portrait_4_3',
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
      logger.info({ requestId, loraType: input.loraType, provider: 'fal', latencyMs }, 'fal.ai sketch completed');

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
