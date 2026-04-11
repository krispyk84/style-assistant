import { z } from 'zod';

import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

// ── Internal transport → parser contract ──────────────────────────────────────
// The transport layer (fetch) produces this shape and hands it to the parser.
// The parser never sees the raw Response object; it never calls .json().

export type RawHttpResponse = {
  ok: boolean;      // response.ok — true iff HTTP 2xx
  status: number;   // HTTP status code
  payload: unknown; // result of response.json() — null if body parsing failed
};

// ── Output text extraction ────────────────────────────────────────────────────
// Handles two response shapes from the Responses API:
//   1. Top-level output_text string (fast path)
//   2. Nested output[*].content[*] walk for type=output_text|text

export function extractOutputText(payload: unknown): string | null {
  if (typeof (payload as any)?.output_text === 'string' && (payload as any).output_text.trim()) {
    return (payload as any).output_text;
  }

  if (!Array.isArray((payload as any)?.output)) {
    return null;
  }

  for (const item of (payload as any).output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        (content?.type === 'output_text' || content?.type === 'text') &&
        typeof content?.text === 'string' &&
        content.text.trim()
      ) {
        return content.text;
      }
    }
  }

  return null;
}

// ── Structured response parser ────────────────────────────────────────────────
// Validates the HTTP status, extracts and JSON-parses the output text, runs Zod
// validation, and extracts token counts for usage tracking.
// Throws HttpError on every failure path — none of these are retryable.

export function parseStructuredResponse<TSchema extends z.ZodTypeAny>(
  raw: RawHttpResponse,
  schema: TSchema,
): { data: z.infer<TSchema>; inputTokens: number; outputTokens: number } {
  const payload = raw.payload as any;

  if (!raw.ok) {
    const openAiError = payload?.error?.message ?? JSON.stringify(payload?.error) ?? 'Unknown OpenAI error';
    logger.error(
      { statusCode: raw.status, responseId: payload?.id, error: openAiError },
      'OpenAI Responses API request failed',
    );
    throw new HttpError(502, 'OPENAI_REQUEST_FAILED', 'The AI provider could not complete the request.');
  }

  const outputText = extractOutputText(raw.payload);
  if (!outputText) {
    logger.error({ responseId: payload?.id }, 'OpenAI response did not include structured output text');
    throw new HttpError(502, 'OPENAI_INVALID_RESPONSE', 'The AI provider returned an empty response.');
  }

  const parsed = JSON.parse(outputText);
  const validated = schema.safeParse(parsed);

  if (!validated.success) {
    logger.error(
      { responseId: payload?.id, issues: validated.error.flatten() },
      'OpenAI response did not match the expected schema',
    );
    throw new HttpError(502, 'OPENAI_SCHEMA_MISMATCH', 'The AI provider returned an unexpected response shape.');
  }

  const inputTokens: number = payload?.usage?.input_tokens ?? 0;
  const outputTokens: number = payload?.usage?.output_tokens ?? 0;

  return { data: validated.data, inputTokens, outputTokens };
}

// ── Image response parser ─────────────────────────────────────────────────────

export function parseImageResponse(raw: RawHttpResponse): { imageBase64: string } {
  const payload = raw.payload as any;

  if (!raw.ok) {
    logger.error(
      {
        statusCode: raw.status,
        error: payload?.error?.message ?? payload?.error ?? 'Unknown OpenAI image generation error',
      },
      'OpenAI image generation failed',
    );
    throw new HttpError(502, 'OPENAI_IMAGE_FAILED', 'The AI provider could not generate the sketch.');
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    logger.error({ payload }, 'OpenAI image generation response did not include image data');
    throw new HttpError(502, 'OPENAI_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
  }

  return { imageBase64 };
}
