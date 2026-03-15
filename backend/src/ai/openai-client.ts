import { z } from 'zod';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type JsonSchemaConfig = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
};

type OpenAiVectorStoreSearchResult = {
  score?: number;
  filename?: string;
  content: Array<{
    type: string;
    text: string;
  }>;
};

type InputContent =
  | {
      type: 'input_text';
      text: string;
    }
  | {
      type: 'input_image';
      image_url: string;
      detail?: 'low' | 'high' | 'auto';
    };

type CreateStructuredResponseInput<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  jsonSchema: JsonSchemaConfig;
  instructions: string;
  userContent: InputContent[];
};

function extractOutputText(payload: any): string | null {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload?.output)) {
    return null;
  }

  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content?.text === 'string' && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

export const openAiClient = {
  async createStructuredResponse<TSchema extends z.ZodTypeAny>(
    input: CreateStructuredResponseInput<TSchema>
  ): Promise<z.infer<TSchema>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.OPENAI_BASE_URL}/v1/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OPENAI_RESPONSES_MODEL,
          instructions: input.instructions,
          input: [
            {
              role: 'user',
              content: input.userContent,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: input.jsonSchema.name,
              description: input.jsonSchema.description,
              strict: true,
              schema: input.jsonSchema.schema,
            },
          },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        logger.error(
          {
            statusCode: response.status,
            responseId: payload?.id,
            error: payload?.error?.message ?? payload?.error ?? 'Unknown OpenAI error',
          },
          'OpenAI Responses API request failed'
        );

        throw new HttpError(502, 'OPENAI_REQUEST_FAILED', 'The AI provider could not complete the request.');
      }

      const outputText = extractOutputText(payload);
      if (!outputText) {
        logger.error({ responseId: payload?.id }, 'OpenAI response did not include structured output text');
        throw new HttpError(502, 'OPENAI_INVALID_RESPONSE', 'The AI provider returned an empty response.');
      }

      const parsed = JSON.parse(outputText);
      const validated = input.schema.safeParse(parsed);

      if (!validated.success) {
        logger.error(
          {
            responseId: payload?.id,
            issues: validated.error.flatten(),
          },
          'OpenAI response did not match the expected schema'
        );

        throw new HttpError(502, 'OPENAI_SCHEMA_MISMATCH', 'The AI provider returned an unexpected response shape.');
      }

      return validated.data;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('OpenAI request timed out');
        throw new HttpError(504, 'OPENAI_TIMEOUT', 'The AI provider timed out.');
      }

      logger.error({ error }, 'Unexpected OpenAI client failure');
      throw new HttpError(502, 'OPENAI_UNAVAILABLE', 'The AI provider is currently unavailable.');
    } finally {
      clearTimeout(timeout);
    }
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
        'OpenAI file upload failed'
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
        'OpenAI vector store creation failed'
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
        'OpenAI vector store file batch failed'
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
        'OpenAI vector store retrieval failed'
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
      logger.error(
        {
          statusCode: response.status,
          error: payload?.error?.message ?? payload?.error ?? 'Unknown vector store search error',
        },
        'OpenAI vector store search failed'
      );

      throw new HttpError(502, 'OPENAI_VECTOR_STORE_SEARCH_FAILED', 'The style guide could not be searched.');
    }

    return payload.data as OpenAiVectorStoreSearchResult[];
  },
};
