import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { IMAGEN_COST_USD, IMAGEN_FAST_COST_USD } from './costs.js';
import { usageService } from '../modules/usage/usage.service.js';
import type { GenerateImageInput } from './fal-client.js';

/**
 * Google Imagen on Vertex AI / AI Studio — image generation client.
 *
 * Auth modes (set via IMAGEN_AUTH_TYPE env var):
 *
 *   apikey (default for testing)
 *     Uses a Google AI Studio API key against generativelanguage.googleapis.com.
 *     Set IMAGEN_API_KEY=<your key>.
 *     Best for: local testing and evaluation.
 *
 *   serviceaccount (recommended for production)
 *     Uses a Vertex AI OAuth2 Bearer token against aiplatform.googleapis.com.
 *     Set IMAGEN_PROJECT_ID, IMAGEN_LOCATION, and IMAGEN_ACCESS_TOKEN.
 *     IMAGEN_ACCESS_TOKEN expires after ~1 hour. For long-running deployments,
 *     generate it at startup via `google-auth-library` or `gcloud auth print-access-token`
 *     and restart the server when it expires, or add token-refresh logic.
 *
 * Style note:
 *   Imagen does not support custom LoRA, so VESTURE_OUTFIT/VESTURE_ITEM trigger
 *   words are replaced with explicit fashion-illustration style instructions.
 *   Output quality and aesthetic will differ from the fal.ai Flux-LoRA path —
 *   this difference is the whole point of evaluation.
 */

// Base negative prompt — mirrors the fal.ai NEGATIVE_PROMPT for fair comparison
const BASE_NEGATIVE_PROMPT =
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, ' +
  'product photography, studio photo, digital painting, oil painting, anime, cartoon, ' +
  'flat lay, flatlay, lookbook, clothing hanger, product display, clothes folded, styled flat, ' +
  'cropped at knees, cropped at ankles, cut-off feet, shoes cut off, partial legs, incomplete figure, torso only';

/**
 * Style prefix for outfit sketches.
 * Replaces the VESTURE_OUTFIT LoRA trigger word — guides Imagen toward the
 * fashion-illustration aesthetic that the Flux LoRA produces natively.
 */
const OUTFIT_STYLE_PREFIX =
  'fashion illustration, editorial watercolor sketch, fashion design illustration, ' +
  'fine-line ink and wash, muted warm ivory background, antique paper tone, ' +
  'headless tailored mannequin, full-length fashion plate';

/**
 * Style prefix for closet single-garment sketches.
 * Replaces the VESTURE_ITEM LoRA trigger word.
 */
const CLOSET_STYLE_PREFIX =
  'fashion sketch illustration, single garment editorial drawing, ' +
  'fine-line watercolor, faithful construction rendering, ' +
  'flat warm ivory-white background, antique paper tone, no gradient, no vignette';

function buildPrompt(input: GenerateImageInput): string {
  const prefix = input.loraType === 'closet' ? CLOSET_STYLE_PREFIX : OUTFIT_STYLE_PREFIX;
  return `${prefix}, ${input.prompt}`;
}

function buildNegativePrompt(additionalNegativePrompt?: string): string {
  return additionalNegativePrompt
    ? `${BASE_NEGATIVE_PROMPT}, ${additionalNegativePrompt}`
    : BASE_NEGATIVE_PROMPT;
}

// ─── Auth mode: apikey ────────────────────────────────────────────────────────
// Uses Google AI Studio / Gemini Developer API.
// Endpoint action: :generateImages (NOT :predict — that is Vertex AI only).
// Request/response format differs from Vertex AI; no negativePrompt support.

function buildApiKeyRequest(prompt: string) {
  return {
    prompt,
    number_of_images: 1,
    aspect_ratio: '3:4',
    safety_filter_level: 'BLOCK_SOME',
    person_generation: 'ALLOW_ALL',
  };
}

function parseApiKeyResponse(data: unknown): { base64: string; mimeType: string } {
  const image = (data as any)?.generatedImages?.[0]?.image;
  const base64: unknown = image?.imageBytes;
  if (typeof base64 !== 'string' || !base64) {
    throw new HttpError(502, 'IMAGEN_INVALID_RESPONSE', 'The Imagen provider returned an invalid response.');
  }
  return { base64, mimeType: 'image/png' };
}

// ─── Auth mode: serviceaccount ────────────────────────────────────────────────
// Uses Vertex AI endpoint with OAuth2 Bearer token.
// Request/response follows the Vertex AI :predict format; supports negativePrompt.

function buildServiceAccountRequest(prompt: string, negativePrompt: string) {
  return {
    instances: [{ prompt, negativePrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '3:4',
      addWatermark: false,
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_all',
    },
  };
}

function parseServiceAccountResponse(data: unknown): { base64: string; mimeType: string } {
  const prediction = (data as any)?.predictions?.[0];
  const base64: unknown = prediction?.bytesBase64Encoded;
  const mimeType: string = prediction?.mimeType ?? 'image/png';
  if (typeof base64 !== 'string' || !base64) {
    throw new HttpError(502, 'IMAGEN_INVALID_RESPONSE', 'The Imagen provider returned an invalid response.');
  }
  return { base64, mimeType };
}

// ─── URL + headers ─────────────────────────────────────────────────────────────

function resolveApiUrl(): string {
  if (env.IMAGEN_AUTH_TYPE === 'serviceaccount') {
    const loc = env.IMAGEN_LOCATION;
    const proj = env.IMAGEN_PROJECT_ID;
    if (!proj) {
      throw new HttpError(500, 'IMAGEN_CONFIG_MISSING', 'IMAGEN_PROJECT_ID is required when IMAGEN_AUTH_TYPE=serviceaccount.');
    }
    return `https://${loc}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}/publishers/google/models/${env.IMAGEN_MODEL}:predict`;
  }
  if (!env.IMAGEN_API_KEY) {
    throw new HttpError(500, 'IMAGEN_CONFIG_MISSING', 'IMAGEN_API_KEY is required when IMAGEN_AUTH_TYPE=apikey.');
  }
  // Gemini Developer API uses :generateImages, not :predict
  return `https://generativelanguage.googleapis.com/v1beta/models/${env.IMAGEN_MODEL}:generateImages?key=${env.IMAGEN_API_KEY}`;
}

function resolveAuthHeaders(): Record<string, string> {
  const base = { 'Content-Type': 'application/json' };
  if (env.IMAGEN_AUTH_TYPE === 'serviceaccount') {
    if (!env.IMAGEN_ACCESS_TOKEN) {
      throw new HttpError(500, 'IMAGEN_CONFIG_MISSING', 'IMAGEN_ACCESS_TOKEN is required when IMAGEN_AUTH_TYPE=serviceaccount.');
    }
    return { ...base, Authorization: `Bearer ${env.IMAGEN_ACCESS_TOKEN}` };
  }
  return base;
}

function resolveImagenCostUsd(): number {
  // Fast variant is half the cost of the standard model
  return env.IMAGEN_MODEL.includes('fast') ? IMAGEN_FAST_COST_USD : IMAGEN_COST_USD;
}

export const imagenClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    const prompt = buildPrompt(input);
    const negativePrompt = buildNegativePrompt(input.additionalNegativePrompt);

    logger.info(
      {
        provider: 'imagen',
        model: env.IMAGEN_MODEL,
        authType: env.IMAGEN_AUTH_TYPE,
        loraType: input.loraType,
        prompt,
      },
      'Imagen sketch generation starting'
    );

    const startMs = Date.now();

    // apikey mode (Gemini Developer API) does not support negativePrompt —
    // style is controlled entirely via the positive prompt prefix.
    const requestBody = env.IMAGEN_AUTH_TYPE === 'serviceaccount'
      ? buildServiceAccountRequest(prompt, negativePrompt)
      : buildApiKeyRequest(prompt);

    try {
      const url = resolveApiUrl();
      const headers = resolveAuthHeaders();

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const latencyMs = Date.now() - startMs;

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        logger.error(
          { statusCode: res.status, error: errorBody, provider: 'imagen', latencyMs },
          'Imagen API request failed'
        );
        throw new HttpError(502, 'IMAGEN_REQUEST_FAILED', 'The Imagen provider returned an error.');
      }

      const responseData = await res.json();
      const { base64, mimeType } = env.IMAGEN_AUTH_TYPE === 'serviceaccount'
        ? parseServiceAccountResponse(responseData)
        : parseApiKeyResponse(responseData);

      logger.info(
        { provider: 'imagen', model: env.IMAGEN_MODEL, loraType: input.loraType, latencyMs, mimeType },
        'Imagen sketch generation completed'
      );

      if (input.supabaseUserId) {
        usageService.record({
          supabaseUserId: input.supabaseUserId,
          feature: input.loraType === 'closet' ? 'closet-sketch' : 'outfit-sketch',
          model: env.IMAGEN_MODEL,
          costUsd: resolveImagenCostUsd(),
        });
      }

      return {
        mimeType,
        data: Buffer.from(base64, 'base64'),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error({ error, provider: 'imagen', loraType: input.loraType }, 'Unexpected Imagen failure');
      throw new HttpError(502, 'IMAGEN_UNAVAILABLE', 'The Imagen provider is currently unavailable.');
    }
  },
};
