import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import { usageService } from '../modules/usage/usage.service.js';
import type { GenerateImageInput } from './fal-client.js';

/**
 * Gemini image generation client — uses Google's multimodal generateContent API
 * to generate outfit sketches conditioned on visual style reference images.
 *
 * Unlike Imagen (text-only) or fal.ai (LoRA trigger words), this client sends
 * the 3 Vesture style-reference JPGs directly as input parts alongside the outfit
 * description text. Gemini sees the actual reference sketches and generates an image
 * in the same illustration style.
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
 * Auth: Google AI Studio API key (IMAGEN_API_KEY — shared with the Imagen path)
 */

// ─── Style reference loading ──────────────────────────────────────────────────

const STYLE_REFS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'style-refs');

const OUTFIT_REF_FILES = [
  'outfit-style-ref-1.jpg',
  'outfit-style-ref-2.jpg',
  'outfit-style-ref-3.jpg',
];

// Loaded once at module initialisation so generation calls have no file I/O cost.
let _outfitStyleRefs: Array<{ mimeType: 'image/jpeg'; base64: string }> | null = null;

function loadOutfitStyleRefs(): Array<{ mimeType: 'image/jpeg'; base64: string }> {
  if (_outfitStyleRefs) return _outfitStyleRefs;
  _outfitStyleRefs = OUTFIT_REF_FILES.map((filename) => ({
    mimeType: 'image/jpeg' as const,
    base64: readFileSync(join(STYLE_REFS_DIR, filename)).toString('base64'),
  }));
  logger.info({ count: _outfitStyleRefs.length }, 'Gemini style refs loaded');
  return _outfitStyleRefs;
}

// ─── Prompt construction ──────────────────────────────────────────────────────

/**
 * Builds the instruction text that accompanies the style reference images.
 *
 * The prompt is split into two explicit concerns so Gemini keeps them separate:
 *   STYLE: defined entirely by the reference images — replicate, don't invent
 *   CONTENT: defined entirely by the outfit description text — draw these items
 *
 * Negative instruction prevents Gemini from blending the reference outfits into
 * the new sketch (the most common failure mode with multi-image conditioning).
 */
function buildOutfitPrompt(outfitPrompt: string): string {
  return (
    'These are style reference images for a luxury menswear fashion illustration app. ' +
    'Generate a new outfit sketch that EXACTLY replicates the illustration style of these references:\n' +
    '- same watercolor rendering technique\n' +
    '- same ink line quality and stroke character\n' +
    '- same warm parchment background with loose watercolor wash clouds\n' +
    '- same headless mannequin / dress form presentation\n' +
    '- same muted, desaturated colour palette\n' +
    '- same editorial luxury fashion-sketch aesthetic\n\n' +
    'DO NOT copy any garments, outfits, or accessories from the reference images. ' +
    'The references control ONLY the visual illustration style.\n\n' +
    'Draw this specific outfit instead:\n' +
    outfitPrompt
  );
}

function buildClosetPrompt(itemPrompt: string): string {
  return (
    'These are style reference images for a luxury menswear fashion illustration app. ' +
    'Generate a single-garment fashion sketch that EXACTLY replicates the illustration style of these references:\n' +
    '- same watercolor rendering technique\n' +
    '- same ink line quality\n' +
    '- same warm parchment background\n' +
    '- same muted, desaturated colour palette\n\n' +
    'DO NOT copy any garments from the reference images. ' +
    'The references control ONLY the illustration style.\n\n' +
    'Draw this specific garment:\n' +
    itemPrompt
  );
}

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

// ─── Client ───────────────────────────────────────────────────────────────────

export const geminiImageClient = {
  async generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    if (!env.IMAGEN_API_KEY) {
      throw new HttpError(500, 'GEMINI_IMAGE_CONFIG_MISSING', 'IMAGEN_API_KEY is required for IMAGE_PROVIDER=gemini-image.');
    }

    const styleRefs = loadOutfitStyleRefs();

    const promptText = input.loraType === 'closet'
      ? buildClosetPrompt(input.prompt)
      : buildOutfitPrompt(input.prompt);

    logger.info(
      {
        provider: 'gemini-image',
        model: env.GEMINI_IMAGE_MODEL,
        loraType: input.loraType,
        styleRefCount: styleRefs.length,
        promptLength: promptText.length,
      },
      'Gemini style-conditioned sketch generation starting'
    );

    const startMs = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent?key=${env.IMAGEN_API_KEY}`;

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
        { provider: 'gemini-image', model: env.GEMINI_IMAGE_MODEL, loraType: input.loraType, latencyMs, mimeType },
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
};
