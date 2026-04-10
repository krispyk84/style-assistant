import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Prompts for fal.ai flux-lora sketch generation.
 *
 * Anchor fidelity design:
 * - The anchor item is the PRIMARY visual constraint. Tier/style only affects the
 *   surrounding pieces, not the anchor itself.
 * - Anchor locking: the anchor is declared first after composition framing, with
 *   "preserve category and construction exactly" to block archetype substitution.
 * - Tier is positioned as a modifier ("outfit built around the anchor") rather than
 *   a declaration — prevents "Business attire" from activating a blazer/suit prior
 *   before the anchor description registers.
 * - Category-specific drift negatives (see ANCHOR_DRIFT_NEGATIVES) are injected into
 *   the negative prompt by the caller (tier-sketch.service.ts) so the model cannot
 *   substitute a tier-appropriate garment for the user's actual anchor item.
 *
 * Accessories are split: worn-on-body (belt, watch, tie) vs beside-mannequin (bag, glasses).
 * Piece names stripped of trailing "with X" / "— X" clauses, capped at 6 words.
 * Fit adjectives (tailored, slim-fit, wide-leg, oversized) appear early and are preserved.
 */

/**
 * Accessories that are worn ON the body and should be visible in the sketch.
 */
const WORN_ACCESSORY_KEYWORDS = [
  'belt', 'watch', 'tie', 'scarf', 'pocket square', 'bracelet', 'necklace',
  'ring', 'suspenders', 'cufflinks',
];

/**
 * Accessories that float ABOVE the headless figure (hats, caps).
 * Checked before BESIDE so these don't fall into the beside bucket.
 */
const ABOVE_ACCESSORY_KEYWORDS = [
  'hat', 'cap', 'beanie', 'fedora', 'beret', 'bucket hat', 'snapback', 'baseball cap',
];

/**
 * Accessories that are placed BESIDE the mannequin (not on-body).
 */
const BESIDE_ACCESSORY_KEYWORDS = [
  'bag', 'tote', 'backpack', 'briefcase', 'sunglasses', 'glasses', 'umbrella', 'gloves',
];

/**
 * Trim verbose AI piece names to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" clauses, then caps at 6 words.
 * Only used for supporting pieces (keyPieces, shoes, accessories) — NOT the anchor.
 */
function shortenPieceName(name: string): string {
  const stripped = name.split(/\s+with\s+|\s+—\s+|\s+featuring\s+/i)[0] ?? name;
  const words = stripped.trim().split(/\s+/);
  return words.slice(0, 6).join(' ');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return shortenPieceName(piece.display_name);
}

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' | 'above' {
  const cat = (piece.metadata?.category ?? '').toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;

  if (ABOVE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'above';
  if (WORN_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'worn';
  if (BESIDE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'beside';
  return 'beside';
}

export function buildClosetItemSketchPrompt(input: { itemDescription: string; gender?: string | null }) {
  return (
    `${input.itemDescription.trim()}, ` +
    `single garment on headless dress form, no head no face, faithful stylized illustration, preserve all construction details, ` +
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

  // Anchor: use the raw input verbatim — NOT shortenPieceName() (which caps at 6 words
  // and would strip silhouette-defining detail from the anchor description).
  // This is either the OpenAI vision-derived structural description from
  // describeAnchorForSketch, or the plain-text anchorItemDescription as fallback.
  const anchor = input.anchorItemDescription.trim();

  // Supporting pieces only (never include the anchor here — it is declared separately
  // as a locked primary constraint and must not compete with its own description).
  const keyPieces = input.recommendation.keyPieces.slice(0, 4).map(pieceLabel);
  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel);

  const wornAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'worn')
    .slice(0, 3)
    .map(pieceLabel);

  const besideAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'beside')
    .slice(0, 2)
    .map(pieceLabel);

  const aboveAccessories = input.recommendation.accessories
    .filter((p) => classifyAccessory(p) === 'above')
    .slice(0, 1)
    .map(pieceLabel);

  const keyPiecesStr = keyPieces.filter(Boolean).join(', ');
  const shoesStr = shoes.filter(Boolean).join(', ');

  // Label each slot explicitly so the image model cannot substitute archetype defaults.
  // Tier label is intentionally omitted — it activates model priors (blazer for smart-casual,
  // brown boots for casual) that override the actual piece descriptions.
  const keyPiecesPart = keyPiecesStr ? `outfit pieces: ${keyPiecesStr}` : null;
  // Shoes get their own labeled slot so they are not buried in a comma list.
  const shoesPart = shoesStr ? `shoes: ${shoesStr}` : null;

  const wornPart = wornAccessories.length > 0
    ? `${wornAccessories.join(', ')} visible`
    : null;

  const besidePart = besideAccessories.length > 0
    ? `${besideAccessories.join(', ')} beside`
    : 'accessories beside';

  const abovePart = aboveAccessories.length > 0
    ? `${aboveAccessories.join(', ')} floating above the figure`
    : null;

  // Anchor locking: declared first, in the highest-weight token position.
  // "preserve garment category and construction exactly" is a hard rendering constraint.
  const anchorLock = `anchor item worn: ${anchor}, preserve garment category and construction exactly`;

  return [
    'single figure only, one headless mannequin centered, headless dress form, no head no face, full-length fashion illustration, complete figure visible from shoulders to feet, full pants length visible, shoes fully visible at bottom of frame, feet touching ground, no cropping at ankles or feet',
    anchorLock,
    keyPiecesPart,
    shoesPart,
    wornPart,
    besidePart,
    abovePart,
    'warm ivory watercolor wash background, antique paper tone',
  ]
    .filter(Boolean)
    .join(', ');
}
