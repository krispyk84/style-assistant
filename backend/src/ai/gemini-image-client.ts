import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { usageService } from '../modules/usage/usage.service.js';
import { OUTFIT_STYLE_REFS } from './style-refs-data.js';
import { buildOutfitPrompt, buildClosetPrompt } from './gemini-prompt-builder.js';
import { buildHaircutEditPrompt, buildHaircutAngleEditPrompt, type HaircutAngle, type HaircutStyle } from './prompts/haircut.prompts.js';

export type GenerateImageInput = {
  prompt: string;
  loraType: 'closet' | 'outfit';
  itemType?: 'garment' | 'accessory';
  sourceImageUrl?: string;
  supabaseUserId?: string;
  additionalNegativePrompt?: string;
};

/**
 * Gemini image generation client — uses Google's multimodal generateContent API
 * to generate outfit sketches conditioned on visual style reference images.
 *
 * This client sends the 3 Vesture style-reference JPGs directly as input parts
 * alongside the outfit description text. Gemini sees the actual reference
 * sketches and generates an image in the same illustration style.
 *
 * Style references live in: src/ai/style-refs/
 *   outfit-style-ref-1.jpg — smart casual earth tones, watercolor ink sketch
 *   outfit-style-ref-2.jpg — smart casual tweed minimal, ink and wash
 *   outfit-style-ref-3.jpg — sunlit neutrals, watercolor editorial
 *
 * To update the style references: replace the JPGs in style-refs/ and redeploy.
 * No code changes needed — the refs are loaded at module initialisation.
 *
 * Endpoint: POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Auth: Google AI Studio API key (GEMINI_API_KEY)
 *
 * Not currently called by any sketch path (all sketches use OpenAI gpt-image-1-mini,
 * see backend/src/ai/openai-client.ts). Kept for the Haircut Planner feature, which
 * will repurpose this multi-image-input request shape to condition on a user's
 * uploaded headshot rather than the static style refs.
 */

// Style refs are bundled as base64 constants in style-refs-data.ts —
// no filesystem reads, works in any deployment environment.

// ─── Request / response ───────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

function buildRequest(styleRefs: Array<{ mimeType: string; base64: string }>, promptText: string) {
  const parts: GeminiPart[] = [
    // Style reference images first — Gemini weights earlier parts more heavily
    ...styleRefs.map((ref) => ({
      inlineData: { mimeType: ref.mimeType, data: ref.base64 },
    })),
    { text: promptText },
  ];

  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };
}

function parseResponse(data: unknown): { base64: string; mimeType: string } {
  const candidates = (data as { candidates?: GeminiCandidate[] })?.candidates;
  if (!candidates?.length) {
    throw new HttpError(502, 'GEMINI_IMAGE_INVALID_RESPONSE', 'Gemini returned no candidates.');
  }
  const parts = candidates[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) {
    throw new HttpError(502, 'GEMINI_IMAGE_INVALID_RESPONSE', 'Gemini response contained no image part.');
  }
  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

// ─── Cost ─────────────────────────────────────────────────────────────────────

// gemini-2.5-flash-image: ~$0.04/image (approximate; billed per token)
const GEMINI_IMAGE_COST_USD = 0.04;

// ─── Haircut edit ─────────────────────────────────────────────────────────────
// Same underlying generateContent call as generateImage() above, but the single
// image part sent is the user's own uploaded headshot (not a static style ref),
// and the prompt instructs an identity-preserving hair-only edit.

export type GenerateHaircutImageInput = {
  /** A data: URL (data:<mimeType>;base64,<data>) — see resolveImageUrlForAI(). */
  headshotDataUrl: string;
  style: HaircutStyle;
  supabaseUserId?: string;
};

export type GenerateHaircutAngleShotInput = {
  /** A data: URL of the already-generated haircut photo (the chosen option's image), not the original headshot. */
  haircutImageDataUrl: string;
  style: HaircutStyle;
  angle: HaircutAngle;
  supabaseUserId?: string;
};

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1]!, base64: match[2]! };
}

async function dispatchHaircutGeneration(params: {
  sourceDataUrl: string;
  promptText: string;
  logKey: string;
  supabaseUserId?: string;
}): Promise<{ mimeType: string; data: Buffer }> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, 'GEMINI_IMAGE_CONFIG_MISSING', 'GEMINI_API_KEY is required to use the Gemini image client.');
  }

  const source = parseDataUrl(params.sourceDataUrl);
  if (!source) {
    throw new HttpError(500, 'HAIRCUT_IMAGE_INVALID', 'The source image could not be prepared for editing.');
  }

  logger.info(
    { provider: 'gemini-image', model: env.GEMINI_IMAGE_MODEL, logKey: params.logKey, feature: 'haircut-generation' },
    'Gemini haircut generation starting'
  );

  const startMs = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest([source], params.promptText)),
    });

    const latencyMs = Date.now() - startMs;

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      logger.error(
        { statusCode: res.status, error: errorBody, provider: 'gemini-image', logKey: params.logKey, latencyMs },
        'Gemini haircut generation request failed'
      );
      throw new HttpError(502, 'GEMINI_HAIRCUT_FAILED', 'The AI provider could not render this image.');
    }

    const responseData = await res.json();
    const { base64, mimeType } = parseResponse(responseData);

    logger.info(
      { provider: 'gemini-image', model: env.GEMINI_IMAGE_MODEL, logKey: params.logKey, latencyMs, mimeType },
      'Gemini haircut generation completed'
    );

    if (params.supabaseUserId) {
      usageService.record({
        supabaseUserId: params.supabaseUserId,
        feature: 'haircut-generation',
        model: env.GEMINI_IMAGE_MODEL,
        costUsd: GEMINI_IMAGE_COST_USD,
      });
    }

    return { mimeType, data: Buffer.from(base64, 'base64') };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logger.error({ error, provider: 'gemini-image', logKey: params.logKey }, 'Unexpected Gemini haircut generation failure');
    throw new HttpError(502, 'GEMINI_HAIRCUT_UNAVAILABLE', 'The AI provider is currently unavailable for haircut rendering.');
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const geminiImageClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    if (!env.GEMINI_API_KEY) {
      throw new HttpError(500, 'GEMINI_IMAGE_CONFIG_MISSING', 'GEMINI_API_KEY is required to use the Gemini image client.');
    }

    const styleRefs = OUTFIT_STYLE_REFS;

    const promptText = input.loraType === 'closet'
      ? buildClosetPrompt(input.prompt)
      : buildOutfitPrompt(input.prompt);

    logger.info(
      {
        provider: 'gemini-image',
        model: env.GEMINI_IMAGE_MODEL,
        endpoint: 'generativelanguage.googleapis.com/v1beta/:generateContent',
        loraType: input.loraType,
        styleRefCount: styleRefs.length,
        fallbackUsed: false,
      },
      'Gemini style-conditioned sketch generation starting'
    );

    const startMs = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequest(styleRefs, promptText)),
      });

      const latencyMs = Date.now() - startMs;

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        logger.error(
          { statusCode: res.status, error: errorBody, provider: 'gemini-image', latencyMs },
          'Gemini image API request failed'
        );
        throw new HttpError(502, 'GEMINI_IMAGE_REQUEST_FAILED', 'The Gemini image provider returned an error.');
      }

      const responseData = await res.json();
      const { base64, mimeType } = parseResponse(responseData);

      logger.info(
        { provider: 'gemini-image', model: env.GEMINI_IMAGE_MODEL, loraType: input.loraType, latencyMs, mimeType, fallbackUsed: false },
        'Gemini style-conditioned sketch generation completed'
      );

      if (input.supabaseUserId) {
        usageService.record({
          supabaseUserId: input.supabaseUserId,
          feature: input.loraType === 'closet' ? 'closet-sketch' : 'outfit-sketch',
          model: env.GEMINI_IMAGE_MODEL,
          costUsd: GEMINI_IMAGE_COST_USD,
        });
      }

      return {
        mimeType,
        data: Buffer.from(base64, 'base64'),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error({ error, provider: 'gemini-image', loraType: input.loraType }, 'Unexpected Gemini image failure');
      throw new HttpError(502, 'GEMINI_IMAGE_UNAVAILABLE', 'The Gemini image provider is currently unavailable.');
    }
  },

  async generateHaircutEdit(input: GenerateHaircutImageInput): Promise<{ mimeType: string; data: Buffer }> {
    return dispatchHaircutGeneration({
      sourceDataUrl: input.headshotDataUrl,
      promptText: buildHaircutEditPrompt(input.style),
      logKey: input.style.key,
      supabaseUserId: input.supabaseUserId,
    });
  },

  async generateHaircutAngleShot(input: GenerateHaircutAngleShotInput): Promise<{ mimeType: string; data: Buffer }> {
    return dispatchHaircutGeneration({
      sourceDataUrl: input.haircutImageDataUrl,
      promptText: buildHaircutAngleEditPrompt(input.style, input.angle),
      logKey: `${input.style.key}:${input.angle}`,
      supabaseUserId: input.supabaseUserId,
    });
  },
};
