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
// Reads the Chat Completions response shape: choices[0].message.content

export function extractOutputText(payload: unknown): string | null {
  const content = (payload as any)?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
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

  const inputTokens: number = payload?.usage?.prompt_tokens ?? 0;
  const outputTokens: number = payload?.usage?.completion_tokens ?? 0;

  return { data: validated.data, inputTokens, outputTokens };
}

// ── Image response parser ─────────────────────────────────────────────────────

// Status codes worth retrying — transient upstream/rate-limit failures. Everything else
// (400 content-policy rejection, 401/403 auth, etc.) is a permanent failure for that prompt.
const RETRYABLE_IMAGE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const CONTENT_POLICY_ERROR_CODES = new Set(['content_policy_violation', 'moderation_blocked', 'image_generation_user_error']);

export function parseImageResponse(raw: RawHttpResponse, logContext?: Record<string, unknown>): { imageBase64: string } {
  const payload = raw.payload as any;

  if (!raw.ok) {
    const errorCode = payload?.error?.code as string | undefined;
    const errorMessage = payload?.error?.message ?? payload?.error ?? 'Unknown OpenAI image generation error';
    const isContentPolicy = errorCode ? CONTENT_POLICY_ERROR_CODES.has(errorCode) : false;
    const retryable = !isContentPolicy && RETRYABLE_IMAGE_STATUS_CODES.has(raw.status);

    logger.error(
      { ...logContext, statusCode: raw.status, errorCode, error: errorMessage, retryable, contentPolicy: isContentPolicy },
      isContentPolicy ? 'OpenAI image generation rejected by content policy' : 'OpenAI image generation failed',
    );

    if (isContentPolicy) {
      throw new HttpError(422, 'OPENAI_IMAGE_CONTENT_POLICY', 'The AI provider flagged this request and could not generate a sketch for it.', undefined, false);
    }
    throw new HttpError(502, 'OPENAI_IMAGE_FAILED', 'The AI provider could not generate the sketch.', undefined, retryable);
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    logger.error({ ...logContext, payload }, 'OpenAI image generation response did not include image data');
    throw new HttpError(502, 'OPENAI_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.', undefined, true);
  }

  return { imageBase64 };
}

// ── Image-with-reference response parser ─────────────────────────────────────
// Parses the Responses API format used when a style-reference image is passed.
// The generated image is in output[0].result (base64).

export function parseImageWithRefResponse(raw: RawHttpResponse): { imageBase64: string } {
  const payload = raw.payload as any;

  if (!raw.ok) {
    logger.error(
      {
        statusCode: raw.status,
        error: payload?.error?.message ?? payload?.error ?? 'Unknown OpenAI image generation error',
      },
      'OpenAI image generation (with style ref) failed',
    );
    throw new HttpError(502, 'OPENAI_IMAGE_FAILED', 'The AI provider could not generate the sketch.');
  }

  const imageBase64 = payload?.output?.[0]?.result;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    logger.error({ payload }, 'OpenAI Responses API image generation did not include image data');
    throw new HttpError(502, 'OPENAI_IMAGE_INVALID', 'The AI provider returned an invalid sketch response.');
  }

  return { imageBase64 };
}
