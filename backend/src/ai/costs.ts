// Pricing as of 2025-04 (USD).
// gpt-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens
// gpt-image-1: per-image cost based on size × quality
// fal.ai flux-lora: $0.006 per image (standard queue pricing)
// Google Imagen 3: $0.04 per image (imagen-3.0-generate-001)
//                  $0.02 per image (imagen-3.0-fast-generate-001)

export const FAL_FLUX_LORA_COST_USD = 0.006;

// imagen-3.0-generate-001 pricing. If using the fast variant, override by
// setting IMAGEN_MODEL=imagen-3.0-fast-generate-001 and note the halved cost.
export const IMAGEN_COST_USD = 0.04;
export const IMAGEN_FAST_COST_USD = 0.02;

export type AiFeature =
  | 'outfit-generation'
  | 'tier-regeneration'
  | 'outfit-sketch'
  | 'closet-analyze'
  | 'closet-describe'
  | 'anchor-sketch-describe'
  | 'closet-match'
  | 'closet-sketch'
  | 'compatibility-check'
  | 'selfie-review'
  | 'second-opinion';

const TEXT_INPUT_COST_PER_TOKEN = 0.15 / 1_000_000;
const TEXT_OUTPUT_COST_PER_TOKEN = 0.60 / 1_000_000;

// gpt-image-1 per-image prices indexed by `${size}:${quality}`
const IMAGE_COST_TABLE: Record<string, number> = {
  '1024x1024:low':    0.011,
  '1024x1024:medium': 0.042,
  '1024x1024:high':   0.167,
  '1024x1536:low':    0.016,
  '1024x1536:medium': 0.063,
  '1024x1536:high':   0.250,
  '1536x1024:low':    0.016,
  '1536x1024:medium': 0.063,
  '1536x1024:high':   0.250,
};
const IMAGE_COST_FALLBACK = 0.063; // 1024x1536 medium (most common call)

export function calcTextCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * TEXT_INPUT_COST_PER_TOKEN + outputTokens * TEXT_OUTPUT_COST_PER_TOKEN;
}

export function calcImageCost(size: string, quality: string): number {
  const resolved = quality === 'auto' ? 'medium' : quality;
  const resolvedSize = size === 'auto' ? '1024x1024' : size;
  return IMAGE_COST_TABLE[`${resolvedSize}:${resolved}`] ?? IMAGE_COST_FALLBACK;
}
