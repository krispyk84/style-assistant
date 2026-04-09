import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * These match the exact format used in the successful local LoRA test:
 *   VESTURE_OUTFIT, [tier] outfit on headless mannequin, [piece 1], [piece 2], ..., accessories beside, warm watercolor wash background
 *   VESTURE_ITEM, [garment], single garment, warm parchment background
 *
 * Rules:
 * - Keep piece names SHORT (≤5 words) — long product descriptions push Flux photorealistic
 * - No instruction-style negatives ("no text", "do not") — use negative_prompt in fal-client instead
 * - Background keyword "warm watercolor wash background" / "warm parchment background" is a trained style signal
 * - No styling direction paragraph — adds noise, dilutes the LoRA trigger
 * - Limit to ≤5 pieces total to keep the prompt concise
 */

/**
 * Trim verbose AI piece names down to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" detail clauses (fabric
 * specifics that add noise), then caps at 6 words to keep the prompt tight.
 * Fit/silhouette adjectives ("tailored", "slim-fit", "wide-leg", "oversized")
 * appear early in the name and are preserved.
 */
function shortenPieceName(name: string): string {
  const stripped = name.split(/\s+with\s+|\s+—\s+|\s+featuring\s+/i)[0] ?? name;
  const words = stripped.trim().split(/\s+/);
  return words.slice(0, 6).join(' ');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return shortenPieceName(piece.display_name);
}

export function buildClosetItemSketchPrompt(input: { itemDescription: string; gender?: string | null }) {
  const shortDescription = shortenPieceName(input.itemDescription);
  return `${shortDescription}, single garment, warm parchment background`;
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  // Take anchor + up to 2 key pieces + shoes (max 4 content tokens total)
  const anchor = shortenPieceName(input.recommendation.anchorItem || input.anchorItemDescription);
  const keyPieces = input.recommendation.keyPieces.slice(0, 2).map(pieceLabel);
  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel);

  const pieces = [anchor, ...keyPieces, ...shoes].filter(Boolean).join(', ');
  const tier = input.tierLabel.toLowerCase();

  return `${tier} outfit on headless mannequin, ${pieces}, accessories beside, warm watercolor wash background`;
}
