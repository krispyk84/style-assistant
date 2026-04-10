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

// ─── Vesture style vocabulary for Imagen ─────────────────────────────────────
//
// Imagen 4 defaults to clean, polished digital illustration when given generic
// style terms. These constants fight that default with specific texture cues that
// push output toward the Vesture editorial watercolor-sketch aesthetic (the same
// look the fal.ai Flux LoRA produces natively via trigger-word fine-tuning).
//
// Each constant targets a distinct visual layer:
//   STYLE_LINES    — ink contour quality (hand-drawn vs perfect digital)
//   STYLE_WASH     — watercolor fill behaviour (loose vs airbrushed)
//   STYLE_BG       — background texture (parchment with watercolor clouds vs flat white)
//   STYLE_PALETTE  — color register (muted/aged vs vivid/saturated)
//   STYLE_FRAME    — editorial register (luxury atelier sketch vs ecommerce render)

const STYLE_LINES =
  'precise ink contour lines with slight hand-drawn roughness, ' +
  'thin-to-thick brush-pen line variation, visible ink stroke texture';

const STYLE_WASH =
  'loose transparent watercolor wash fills, ' +
  'visible watercolor bleed at fabric edges, ' +
  'dry-brush texture on fabric surfaces and shadow folds, ' +
  'soft wet-on-wet colour bleeding in shadow areas, ' +
  'matte paper finish throughout, ' +
  'pigment absorbed into paper grain, no gloss no sheen on any surface, ' +
  'soft diffuse ambient light only, no specular highlights, no reflections, no rim lighting, ' +
  'all fabric and accessories look absorbent and cloth-like, not synthetic not shiny';

const STYLE_BG =
  'warm aged parchment paper background, ' +
  'loose translucent watercolor wash pools and soft clouds behind figure, ' +
  'warm ivory and pale ochre paper tone, subtle paper grain texture';

const STYLE_PALETTE =
  'desaturated muted earthy colour palette, ' +
  'aged toned-down fabric pigments, restrained tonal values, not vivid not saturated';

const STYLE_FRAME =
  'luxury menswear editorial fashion sketch, ' +
  'fashion atelier illustration, refined lookbook illustration';

/**
 * Negative prompt — blocks Imagen 4's default clean-digital and photorealistic
 * tendencies. Sent for both auth modes (negativePrompt lives in the instances
 * object which AI Studio supports; only parameters fields like addWatermark are
 * restricted to Vertex AI).
 */
const BASE_NEGATIVE_PROMPT =
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, ' +
  'product photography, studio photo, ' +
  'digital painting, digital concept art, airbrushed shading, smooth gradient shading, ' +
  'glossy, shiny, plastic sheen, lacquer finish, varnish, satin finish, ' +
  'specular highlights, reflective fabric, metallic sheen, rim lighting, ' +
  'studio product lighting, commercial fashion photography lighting, ray-traced reflections, ' +
  'synthetic fabric texture, polished surface, high gloss, wet look, ' +
  'clean crisp digital lines, perfectly uniform background, ' +
  'flat white background, smooth white background, ' +
  'oil painting, anime, cartoon, flat vector illustration, ' +
  'human head, face, facial features, ' +
  'flat lay, flatlay, clothing hanger, product display, clothes folded, styled flat, ' +
  'cropped at knees, cropped at ankles, cut-off feet, shoes cut off, partial legs, incomplete figure, torso only';

/**
 * Style prefix for outfit sketches.
 * All five style layers combined, plus figure framing.
 * The Flux LoRA achieves this aesthetic via trigger-word fine-tuning; Imagen
 * requires explicit layered cues to reach the same visual register.
 */
const OUTFIT_STYLE_PREFIX =
  `${STYLE_LINES}, ${STYLE_WASH}, ${STYLE_BG}, ${STYLE_PALETTE}, ${STYLE_FRAME}, ` +
  'headless tailor\'s dress form, no head, small round neck finial only, ' +
  'full-length figure from neck finial to shoes';

/**
 * Style prefix for closet single-garment sketches.
 * Same ink/wash/background vocabulary, framed for a single centered item.
 */
const CLOSET_STYLE_PREFIX =
  `${STYLE_LINES}, ${STYLE_WASH}, ${STYLE_BG}, ${STYLE_PALETTE}, ` +
  'single garment fashion sketch, faithful construction rendering, ' +
  'centered single item, no gradient, no vignette';

function buildPrompt(input: GenerateImageInput): string {
  const prefix = input.loraType === 'closet' ? CLOSET_STYLE_PREFIX : OUTFIT_STYLE_PREFIX;
  return `${prefix}, ${input.prompt}`;
}

function buildNegativePrompt(additionalNegativePrompt?: string): string {
  return additionalNegativePrompt
    ? `${BASE_NEGATIVE_PROMPT}, ${additionalNegativePrompt}`
    : BASE_NEGATIVE_PROMPT;
}

// ─── Request / response ───────────────────────────────────────────────────────
// Both auth modes use the same :predict format (instances / parameters).
// negativePrompt lives in the instances object — supported by both AI Studio and Vertex AI.

function buildRequest(prompt: string, negativePrompt: string) {
  return {
    instances: [{ prompt, negativePrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '3:4',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_all',
    },
  };
}

function parseResponse(data: unknown): { base64: string; mimeType: string } {
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
  return `https://generativelanguage.googleapis.com/v1beta/models/${env.IMAGEN_MODEL}:predict?key=${env.IMAGEN_API_KEY}`;
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

    const endpoint = env.IMAGEN_AUTH_TYPE === 'serviceaccount'
      ? `${env.IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/:predict`
      : 'generativelanguage.googleapis.com/v1beta/:predict';

    logger.info(
      {
        provider: 'imagen',
        model: env.IMAGEN_MODEL,
        authType: env.IMAGEN_AUTH_TYPE,
        endpoint,
        loraType: input.loraType,
        fallbackUsed: false,
      },
      'Imagen sketch generation starting'
    );

    const startMs = Date.now();

    const requestBody = buildRequest(prompt, negativePrompt);

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
      const { base64, mimeType } = parseResponse(responseData);

      logger.info(
        { provider: 'imagen', model: env.IMAGEN_MODEL, loraType: input.loraType, latencyMs, mimeType, fallbackUsed: false },
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
