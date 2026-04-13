import { z } from 'zod';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';
import type { AiFeature } from './costs.js';
import { buildStructuredRequestBody, buildImageRequestBody, buildImageWithRefRequestBody } from './openai-request-builder.js';
import type { InputContent, JsonSchemaConfig } from './openai-request-builder.js';
import { parseStructuredResponse, parseImageResponse, parseImageWithRefResponse } from './openai-response-parser.js';
import type { RawHttpResponse } from './openai-response-parser.js';
import { withRetry, MAX_RETRIES } from './openai-retry-handler.js';
import { trackTextUsage, trackImageUsage } from './openai-usage-tracker.js';
import { usageService } from '../modules/usage/usage.service.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type OpenAiVectorStoreSearchResult = {
  score?: number;
  filename?: string;
  content: Array<{
    type: string;
    text: string;
  }>;
};

type CreateStructuredResponseInput<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  jsonSchema: JsonSchemaConfig;
  instructions: string;
  userContent: InputContent[];
  supabaseUserId?: string;
  feature?: AiFeature;
};

type GenerateImageInput = {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  supabaseUserId?: string;
  feature?: AiFeature;
  /** Override the default OPENAI_IMAGE_MODEL for this call (e.g. gpt-image-1-mini for outfit sketches). */
  model?: string;
  /** Override calcImageCost when the model has different pricing than IMAGE_COST_TABLE (e.g. gpt-image-1-mini). */
  costUsd?: number;
  /** When provided, uses the Responses API with multimodal input for style-reference conditioning. Must be an https:// URL. */
  styleRefImageUrl?: string;
};

// ── Transport ─────────────────────────────────────────────────────────────────
// Executes a JSON POST and returns the raw response shape for the parser.
// Does not throw on non-2xx — that is the parser's responsibility.
// May throw AbortError (caught by withRetry) or network errors.

async function dispatch(url: string, body: object, signal: AbortSignal): Promise<RawHttpResponse> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

// ── Client ────────────────────────────────────────────────────────────────────

export const openAiClient = {
  async createStructuredResponse<TSchema extends z.ZodTypeAny>(
    input: CreateStructuredResponseInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const result = await withRetry(
      {
        maxRetries: MAX_RETRIES,
        timeoutMs: env.OPENAI_TIMEOUT_MS,
        feature: input.feature,
        timeoutCode: 'OPENAI_TIMEOUT',
        timeoutMessage: 'The AI provider timed out.',
        unavailableCode: 'OPENAI_UNAVAILABLE',
        unavailableMessage: 'The AI provider is currently unavailable.',
      },
      (signal) =>
        dispatch(
          `${env.OPENAI_BASE_URL}/v1/chat/completions`,
          buildStructuredRequestBody({
            model: env.OPENAI_RESPONSES_MODEL,
            instructions: input.instructions,
            userContent: input.userContent,
            jsonSchema: input.jsonSchema,
          }),
          signal,
        ).then((raw) => parseStructuredResponse(raw, input.schema)),
    );

    if (input.supabaseUserId && input.feature) {
      trackTextUsage({
        supabaseUserId: input.supabaseUserId,
        feature: input.feature,
        model: env.OPENAI_RESPONSES_MODEL,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
    }

    return result.data;
  },

  async generateImage(input: GenerateImageInput) {
    const model = input.model ?? env.OPENAI_IMAGE_MODEL;
    const size = input.size ?? '1024x1536';
    const quality = input.quality ?? 'medium';
    const outputFormat = input.outputFormat ?? 'jpeg';
    const useStyleRef = typeof input.styleRefImageUrl === 'string' && input.styleRefImageUrl.startsWith('https://');

    const result = await withRetry(
      {
        maxRetries: 0, // single attempt — no retry for image generation
        timeoutMs: env.OPENAI_TIMEOUT_MS,
        feature: input.feature,
        timeoutCode: 'OPENAI_IMAGE_TIMEOUT',
        timeoutMessage: 'The AI provider timed out while generating the sketch.',
        unavailableCode: 'OPENAI_IMAGE_UNAVAILABLE',
        unavailableMessage: 'The AI provider is currently unavailable for sketches.',
      },
      (signal) => useStyleRef
        ? dispatch(
            `${env.OPENAI_BASE_URL}/v1/responses`,
            buildImageWithRefRequestBody({
              model,
              prompt: input.prompt,
              styleRefImageUrl: input.styleRefImageUrl!,
              size,
              quality,
              outputFormat,
            }),
            signal,
          ).then((raw) => parseImageWithRefResponse(raw))
        : dispatch(
            `${env.OPENAI_BASE_URL}/v1/images/generations`,
            buildImageRequestBody({
              model,
              prompt: input.prompt,
              size,
              quality,
              outputFormat,
            }),
            signal,
          ).then((raw) => parseImageResponse(raw)),
    );

    if (input.supabaseUserId && input.feature) {
      if (input.costUsd !== undefined) {
        usageService.record({
          supabaseUserId: input.supabaseUserId,
          feature: input.feature,
          model,
          costUsd: input.costUsd,
        });
      } else {
        trackImageUsage({
          supabaseUserId: input.supabaseUserId,
          feature: input.feature,
          model,
          size,
          quality,
        });
      }
    }

    return {
      mimeType: `image/${outputFormat}`,
      data: Buffer.from(result.imageBase64, 'base64'),
    };
  },

  async uploadFile(input: { filename: string; mimeType: string; content: Uint8Array | Buffer | string }) {
    const formData = new FormData();
    const body =
      typeof input.content === 'string'
        ? new TextEncoder().encode(input.content)
        : input.content instanceof Uint8Array
          ? input.content
          : new Uint8Array(input.content);
    const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;

    formData.append('purpose', 'assistants');
    formData.append('file', new Blob([arrayBuffer], { type: input.mimeType }), input.filename);

    const response = await fetch(`${env.OPENAI_BASE_URL}/v1/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.id) {
      logger.error(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown OpenAI file upload error',
        },
        'OpenAI file upload failed',
      );
      throw new HttpError(502, 'OPENAI_FILE_UPLOAD_FAILED', 'The style guide file could not be uploaded.');
    }

    return payload as { id: string };
  },

  async createVectorStore(name: string) {
    const response = await fetch(`${env.OPENAI_BASE_URL}/v1/vector_stores`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ name }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.id) {
      logger.error(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown vector store creation error',
        },
        'OpenAI vector store creation failed',
      );
      throw new HttpError(502, 'OPENAI_VECTOR_STORE_CREATE_FAILED', 'The style guide vector store could not be created.');
    }

    return payload as { id: string; name?: string; file_counts?: { in_progress?: number; completed?: number; failed?: number } };
  },

  async attachFilesToVectorStore(vectorStoreId: string, fileIds: string[]) {
    const response = await fetch(`${env.OPENAI_BASE_URL}/v1/vector_stores/${vectorStoreId}/file_batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.id) {
      logger.error(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown vector store batch error',
        },
        'OpenAI vector store file batch failed',
      );
      throw new HttpError(502, 'OPENAI_VECTOR_STORE_ATTACH_FAILED', 'The style guide file could not be linked to the vector store.');
    }

    return payload as { id: string };
  },

  async getVectorStore(vectorStoreId: string) {
    const response = await fetch(`${env.OPENAI_BASE_URL}/v1/vector_stores/${vectorStoreId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.id) {
      logger.error(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown vector store retrieval error',
        },
        'OpenAI vector store retrieval failed',
      );
      throw new HttpError(502, 'OPENAI_VECTOR_STORE_RETRIEVE_FAILED', 'The style guide vector store could not be checked.');
    }

    return payload as { id: string; status?: string; file_counts?: { in_progress?: number; completed?: number; failed?: number } };
  },

  async searchVectorStore(input: {
    vectorStoreId: string;
    query: string;
    maxResults: number;
    scoreThreshold: number;
  }) {
    const response = await fetch(`${env.OPENAI_BASE_URL}/v1/vector_stores/${input.vectorStoreId}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        query: input.query,
        max_num_results: input.maxResults,
        rewrite_query: true,
        ranking_options: {
          ranker: 'auto',
          score_threshold: input.scoreThreshold,
        },
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !Array.isArray(payload?.data)) {
      // 401 = project lacks vector_store.read — config issue, not a runtime error
      const logFn = response.status === 401 ? logger.warn.bind(logger) : logger.error.bind(logger);
      logFn(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown vector store search error',
        },
        'OpenAI vector store search failed',
      );
      throw new HttpError(502, 'OPENAI_VECTOR_STORE_SEARCH_FAILED', 'The style guide could not be searched.');
    }

    return payload.data as OpenAiVectorStoreSearchResult[];
  },
};
