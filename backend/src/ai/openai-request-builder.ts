// ── Shared input types ────────────────────────────────────────────────────────

export type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' };

export type JsonSchemaConfig = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
};

// ── Internal mapping ──────────────────────────────────────────────────────────
// Map Responses API content types to Chat Completions content part types.

function toCompletionsContent(content: InputContent): object {
  if (content.type === 'input_text') {
    return { type: 'text', text: content.text };
  }
  return {
    type: 'image_url',
    image_url: {
      url: content.image_url,
      ...(content.detail ? { detail: content.detail } : {}),
    },
  };
}

// ── Request body builders ─────────────────────────────────────────────────────
// Pure functions — no env reads, no side effects.

export function buildStructuredRequestBody(params: {
  model: string;
  instructions: string;
  userContent: InputContent[];
  jsonSchema: JsonSchemaConfig;
}): object {
  return {
    model: params.model,
    messages: [
      { role: 'system', content: params.instructions },
      { role: 'user', content: params.userContent.map(toCompletionsContent) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: params.jsonSchema.name,
        description: params.jsonSchema.description,
        strict: true,
        schema: params.jsonSchema.schema,
      },
    },
  };
}

export function buildImageRequestBody(params: {
  model: string;
  prompt: string;
  size: string;
  quality: string;
  outputFormat: string;
}): object {
  return {
    model: params.model,
    prompt: params.prompt,
    size: params.size,
    quality: params.quality,
    output_format: params.outputFormat,
  };
}
