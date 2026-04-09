import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { FAL_FLUX_LORA_COST_USD } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';

type GenerateImageInput = {
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
};

const NEGATIVE_PROMPT =
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, product photography, studio photo, digital painting, oil painting, anime, cartoon';

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
    logger.info({ loraType: input.loraType, prompt: fullPrompt, img2imgMode }, 'fal.ai sketch generation starting');

    // img2img: include source image when a public URL is available.
    // strength=0.45 → Flux starts from the garment's structural geometry (45%
    // image noise) so the output inherits pocket placement, quilting, seam
    // lines, and silhouette while the LoRA still applies the illustration style.
    const img2imgParams =
      input.sourceImageUrl && input.sourceImageUrl.startsWith('https://')
        ? { image_url: input.sourceImageUrl, strength: 0.45 }
        : {};

    try {
      const requestId = await submitToQueue({
        prompt: fullPrompt,
        negative_prompt: NEGATIVE_PROMPT,
        loras: [{ path: loraUrl, scale: 0.9 }],
        // Outfit sketches use square_hd (1024×1024) — portrait_16_9 was too narrow,
        // causing the figure to fill the height and clip shoes at the bottom.
        // Square gives enough canvas for a full-body wide shot with shoes in frame.
        // Closet single-garment sketches use portrait_4_3 (768×1024).
        image_size: isCloset ? 'portrait_4_3' : 'square_hd',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        ...img2imgParams,
      });

      logger.info({ requestId, loraType: input.loraType }, 'fal.ai job queued, polling');

      const result = await pollUntilDone(requestId);
      const imageUrl: unknown = (result as any)?.images?.[0]?.url;
      const contentType: string = (result as any)?.images?.[0]?.content_type ?? 'image/jpeg';

      if (typeof imageUrl !== 'string' || !imageUrl) {
        logger.error({ result, loraType: input.loraType }, 'flux-lora result missing image URL');
        throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
      }

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
