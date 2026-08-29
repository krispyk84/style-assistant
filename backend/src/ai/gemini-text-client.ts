import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

/**
 * Gemini TEXT client — structured JSON generation via generateContent, using
 * responseMimeType/responseSchema for constrained output. Separate from
 * gemini-image-client.ts (that one only does multimodal image generation on
 * a different model — GEMINI_IMAGE_MODEL is an image-only variant that
 * cannot do structured text output).
 *
 * Google Search grounding (`tools: [{ google_search: {} }]`) is NOT enabled
 * here: Gemini's API does not currently allow combining the `tools` grounding
 * mechanism with `responseSchema`-constrained JSON output in the same
 * request, and reliable parsing matters more here than search-grounded
 * freshness. If Gemini lifts that restriction, flip `useSearchGrounding` on
 * generateStructuredContent's caller — the plumbing is already here, just
 * unused (see seasonal-trends.service.ts for where this would be wired in).
 */

// Minimal JSON-Schema-ish type — Gemini's responseSchema accepts a Gemini
// OpenAPI-3-subset schema. In practice a plain JSON Schema object mapped to
// the fields we actually use (type/properties/items/enum/required) is accepted.
export type GeminiJsonSchema = Record<string, unknown>;

export type GenerateStructuredContentInput = {
  instructions: string;
  userPrompt: string;
  responseSchema: GeminiJsonSchema;
  /** Overrides env.GEMINI_TEXT_MODEL for this call. */
  model?: string;
  logKey?: string;
};

export const geminiTextClient = {
  async generateStructuredContent<T = unknown>(input: GenerateStructuredContentInput): Promise<T> {
    if (!env.GEMINI_API_KEY) {
      throw new HttpError(500, 'GEMINI_TEXT_CONFIG_MISSING', 'GEMINI_API_KEY is required to use the Gemini text client.');
    }

    const model = input.model ?? env.GEMINI_TEXT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const body = {
      systemInstruction: { parts: [{ text: input.instructions }] },
      contents: [{ parts: [{ text: input.userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: input.responseSchema,
      },
    };

    const startMs = Date.now();
    logger.info({ provider: 'gemini-text', model, logKey: input.logKey }, 'Gemini structured text generation starting');

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      logger.error({ error, provider: 'gemini-text', logKey: input.logKey }, 'Gemini text request failed to send');
      throw new HttpError(502, 'GEMINI_TEXT_UNAVAILABLE', 'The Gemini text provider is currently unavailable.');
    }

    const latencyMs = Date.now() - startMs;

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      logger.error(
        { statusCode: res.status, error: errorBody, provider: 'gemini-text', logKey: input.logKey, latencyMs },
        'Gemini text API request failed'
      );
      throw new HttpError(502, 'GEMINI_TEXT_REQUEST_FAILED', 'The Gemini text provider returned an error.');
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      logger.error({ provider: 'gemini-text', logKey: input.logKey, data }, 'Gemini text response contained no text part');
      throw new HttpError(502, 'GEMINI_TEXT_INVALID_RESPONSE', 'Gemini returned no content.');
    }

    logger.info({ provider: 'gemini-text', model, logKey: input.logKey, latencyMs }, 'Gemini structured text generation completed');

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      logger.error({ error, provider: 'gemini-text', logKey: input.logKey, text }, 'Gemini text response was not valid JSON');
      throw new HttpError(502, 'GEMINI_TEXT_INVALID_JSON', 'Gemini returned malformed JSON.');
    }
  },
};
