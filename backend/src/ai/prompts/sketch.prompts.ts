import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * Style is handled entirely by the trained LoRA (VESTURE_ITEM / VESTURE_OUTFIT
 * trigger words are prepended in fal-client.ts). These prompts describe only
 * the CONTENT — what to draw, not how to draw it. Competing style descriptors
 * dilute the LoRA's trained aesthetic and must be omitted.
 */

export function buildClosetItemSketchPrompt(input: { itemDescription: string; gender?: string | null }) {
  return [
    input.itemDescription,
    'single garment only, no other clothing, no people, no text, no logos, neutral background',
  ].join(', ');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return piece.display_name;
}

function formatInline(items: OutfitPieceDto[] | string[]) {
  if (!items.length) return 'none';
  return items.map((item) => (typeof item === 'string' ? item : pieceLabel(item))).join(', ');
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  const pieces = [
    input.recommendation.anchorItem || input.anchorItemDescription,
    formatInline(input.recommendation.keyPieces),
    formatInline(input.recommendation.shoes),
    formatInline(input.recommendation.accessories),
  ]
    .filter(Boolean)
    .join(', ');

  return [
    pieces,
    input.recommendation.stylingDirection,
    'full outfit, headless mannequin, accessories beside, no text, no logos, neutral background',
  ]
    .filter(Boolean)
    .join(', ');
}
