// gpt-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens (verified current as of 2026-09)
// gpt-image-1 / gpt-image-1-mini: per-image cost varies by size × quality — verified
// against OpenAI's published pricing (developers.openai.com/api/docs/pricing) 2026-09.

export type AiFeature =
  | 'outfit-generation'
  | 'tier-regeneration'
  | 'outfit-sketch'
  | 'closet-analyze'
  | 'closet-describe'
  | 'anchor-sketch-describe'
  | 'closet-match'
  | 'closet-sketch'
  | 'closet-analyse'
  | 'closet-fit-check'
  | 'compatibility-check'
  | 'selfie-review'
  | 'second-opinion'
  | 'outfit-chat'
  | 'help-me-pick'
  | 'trip-generation'
  | 'trip-sketch'
  | 'haircut-generation'
  | 'trend-sketch'
  | 'color-swatch-sketch';

const TEXT_INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
const TEXT_OUTPUT_COST_PER_TOKEN = 0.60 / 1_000_000;

// Per-image USD prices indexed by `${size}:${quality}`, one table per model —
// this app almost always uses gpt-image-1-mini (env.OPENAI_OUTFIT_SKETCH_MODEL)
// but env.OPENAI_IMAGE_MODEL's own default is the full-price gpt-image-1, so a
// future/misconfigured call site needs its own correct table rather than
// silently pricing a 4-5x-more-expensive image at mini rates.
const IMAGE_COST_TABLE_BY_MODEL: Record<string, Record<string, number>> = {
  'gpt-image-1-mini': {
    '1024x1024:low':    0.005,
    '1024x1024:medium': 0.011,
    '1024x1024:high':   0.036,
    '1024x1536:low':    0.006,
    '1024x1536:medium': 0.015,
    '1024x1536:high':   0.052,
    '1536x1024:low':    0.006,
    '1536x1024:medium': 0.015,
    '1536x1024:high':   0.052,
  },
  'gpt-image-1': {
    '1024x1024:low':    0.011,
    '1024x1024:medium': 0.042,
    '1024x1024:high':   0.167,
    '1024x1536:low':    0.016,
    '1024x1536:medium': 0.063,
    '1024x1536:high':   0.250,
    '1536x1024:low':    0.016,
    '1536x1024:medium': 0.063,
    '1536x1024:high':   0.250,
  },
};
// Used only when the model itself isn't in the table above (unrecognized
// override) — the mini 1024x1536 medium price, since that's this app's
// overwhelmingly common real case.
const IMAGE_COST_FALLBACK = 0.015;

export function calcTextCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * TEXT_INPUT_COST_PER_TOKEN + outputTokens * TEXT_OUTPUT_COST_PER_TOKEN;
}

export function calcImageCost(model: string, size: string, quality: string): number {
  const resolvedQuality = quality === 'auto' ? 'medium' : quality;
  const resolvedSize = size === 'auto' ? '1024x1024' : size;
  const table = IMAGE_COST_TABLE_BY_MODEL[model];
  return table?.[`${resolvedSize}:${resolvedQuality}`] ?? IMAGE_COST_FALLBACK;
}
