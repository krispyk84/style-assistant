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
  // Use the full description verbatim — do NOT apply shortenPieceName here.
  // shortenPieceName caps at 6 words and is designed for verbose AI outfit-piece
  // names, not for the construction-detail inventory produced by describeGarmentFromImage.
  // Stripping it destroys pocket placement, quilting structure, closure details, etc.
  return (
    `${input.itemDescription.trim()}, ` +
    `single garment, faithful stylized illustration, preserve all construction details, ` +
    `flat warm ivory-white background, antique paper tone, no gradient, no vignette`
  );
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
}) {
  const tier = input.tierLabel.toLowerCase();

  // Anchor: use the raw input verbatim — NOT recommendation.anchorItem (AI narrative) and
  // NOT shortenPieceName() which caps at 6 words and can strip silhouette-defining detail.
  // anchorItemDescription is the original user-provided text ("Stone-taupe bomber jacket")
  // and must be preserved exactly so Flux cannot substitute a tier-appropriate garment family.
  const anchor = input.anchorItemDescription.trim();

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
    `${tier} outfit on headless mannequin, full length head to toe`,
    corePieces,
    wornPart,
    besidePart,
    'warm ivory watercolor wash background, antique paper tone',
  ]
    .filter(Boolean)
    .join(', ');
}
