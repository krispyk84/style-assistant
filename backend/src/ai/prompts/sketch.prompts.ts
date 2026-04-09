import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * Format matches the successful local LoRA test:
 *   VESTURE_OUTFIT, [tier] outfit on headless mannequin, [anchor first], [key pieces],
 *   [shoes], [worn accessories] visible, [beside accessories] beside,
 *   warm watercolor wash background
 *
 * Key rules:
 * - Anchor uses the clean raw anchorItemDescription — NOT recommendation.anchorItem
 *   which is an AI narrative ("...as the hero piece, worn open over...") that adds noise
 * - Accessories are split: worn-on-body (belt, watch, tie) vs beside-mannequin (bag, glasses)
 * - Piece names stripped of trailing "with X" / "— X" clauses, capped at 6 words
 * - Fit adjectives (tailored, slim-fit, wide-leg, oversized) appear early and are preserved
 * - No instruction-style negatives — negative_prompt in fal-client handles suppression
 */

/**
 * Accessories that are worn ON the body and should be visible in the sketch.
 * When present these go into "[X] visible" to explicitly tell the model to render them.
 */
const WORN_ACCESSORY_KEYWORDS = [
  'belt', 'watch', 'tie', 'scarf', 'pocket square', 'bracelet', 'necklace',
  'ring', 'suspenders', 'cufflinks',
];

/**
 * Accessories that are placed BESIDE the mannequin (not on-body).
 */
const BESIDE_ACCESSORY_KEYWORDS = [
  'bag', 'tote', 'backpack', 'briefcase', 'sunglasses', 'glasses', 'hat',
  'cap', 'umbrella', 'gloves',
];

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' {
  const cat = (piece.metadata?.category ?? '').toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;

  if (WORN_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'worn';
  if (BESIDE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'beside';
  return 'beside'; // default
}

/**
 * Trim verbose AI piece names to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" clauses (fabric specifics
 * that add noise), then caps at 6 words. Fit/silhouette adjectives
 * (tailored, slim-fit, wide-leg, oversized) appear early and survive.
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
  return `${shortenPieceName(input.itemDescription)}, single garment, warm parchment background`;
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  const tier = input.tierLabel.toLowerCase();

  // Anchor: use the clean raw input — NOT recommendation.anchorItem which is an AI narrative.
  // anchorItemDescription is the original user-provided brief text ("Stone-taupe bomber jacket")
  // and is free of narrative noise. Position it first so it receives the strongest model attention.
  const anchor = shortenPieceName(input.anchorItemDescription);

  // All key pieces (usually 2–3; cap at 4 to stay concise)
  const keyPieces = input.recommendation.keyPieces.slice(0, 4).map(pieceLabel);

  // Primary shoe
  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel);

  // Split accessories: worn on body vs placed beside mannequin
  const wornAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'worn')
    .slice(0, 3)
    .map(pieceLabel);

  const besideAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'beside')
    .slice(0, 2)
    .map(pieceLabel);

  // Build prompt parts
  const corePieces = [anchor, ...keyPieces, ...shoes].filter(Boolean).join(', ');

  // Worn accessories explicitly flagged as "visible" so the model renders them on the body
  const wornPart = wornAccessories.length > 0
    ? `${wornAccessories.join(', ')} visible`
    : null;

  // Beside accessories listed by name so the model places them next to the mannequin
  const besidePart = besideAccessories.length > 0
    ? `${besideAccessories.join(', ')} beside`
    : 'accessories beside';

  return [
    `${tier} outfit on headless mannequin`,
    corePieces,
    wornPart,
    besidePart,
    'warm watercolor wash background',
  ]
    .filter(Boolean)
    .join(', ');
}
