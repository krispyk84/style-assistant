import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Headless constraint — hardcoded at module level so it is structurally impossible
 * to construct a sketch prompt without it. Never passed as a parameter.
 *
 * OPENING uses periods (hard CLIP semantic boundary) and object-framing language
 * ("mannequin", "dress form") to establish a prop prior before any body descriptors.
 * Comma-delimited "no head" in the positive prompt activates the concept "face/head"
 * in CLIP; period-separated object statements do not.
 *
 * CLOSING reinforces after all garment tokens have fired, preventing style-block
 * dilution from overriding the opening constraint near the end of the sequence.
 */
const HEADLESS_OPENING =
  'Headless mannequin figure only. No head. No face. No hair. No neck above the collar line. Fashion illustration on a dress form.';

const HEADLESS_CLOSING = 'Remember: headless mannequin only, no head, no face, no hair.';

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
 * Accessories are split: worn-on-body (belt, watch, tie) vs beside-figure (bag, glasses).
 * Footwear in accessories (Loafers, Boots, etc.) is always classified as worn to prevent
 * phantom flat-lay shoes appearing beside the figure.
 * Piece names stripped of trailing "with X" / "— X" clauses, capped at 8 words.
 * Fit adjectives (tailored, slim-fit, wide-leg, oversized) appear early and are preserved.
 */

/**
 * Outerwear piece categories — when present in keyPieces, the piece gets its own
 * "outermost layer" slot rather than being buried in the generic outfit pieces list.
 */
const OUTERWEAR_KEYWORDS = [
  'blazer', 'jacket', 'coat', 'overcoat', 'topcoat', 'trench', 'parka',
  'anorak', 'peacoat', 'chore coat', 'bomber', 'windbreaker', 'sport coat',
  'suit jacket', 'fleece jacket', 'down jacket', 'quilted jacket',
];

/**
 * Anchor item categories that are mid-layers (worn UNDER outerwear).
 * When the anchor matches one of these AND outerwear is in keyPieces, the anchor
 * lock is reframed as "inner layer" so the model doesn't render it as the outermost piece.
 */
const MIDLAYER_ANCHOR_KEYWORDS = [
  'sweater', 'pullover', 'quarter zip', 'half zip', 'jumper',
  'sweatshirt', 'hoodie', 'cardigan', 'knitwear', 'turtleneck', 'crewneck',
];

function isOuterwear(piece: OutfitPieceDto): boolean {
  const cat = (piece.metadata?.category ?? '').toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;
  return OUTERWEAR_KEYWORDS.some((kw) => haystack.includes(kw));
}

function anchorIsMidLayer(anchorDescription: string): boolean {
  const desc = anchorDescription.toLowerCase();
  return MIDLAYER_ANCHOR_KEYWORDS.some((kw) => desc.includes(kw));
}

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
 * Accessories that are placed beside the figure (bags, eyewear).
 * These are rendered as "styled with the look" rather than "beside" to avoid
 * flat-lay ground placement in the generated sketch.
 */
const BESIDE_ACCESSORY_KEYWORDS = [
  'bag', 'tote', 'backpack', 'briefcase', 'sunglasses', 'glasses', 'umbrella', 'gloves',
];

/**
 * Footwear schema categories — always rendered ON the figure, never beside or above.
 * Prevents loafers/boots in the accessories array from appearing as flat-lay props.
 */
const FOOTWEAR_CATEGORIES = ['Boots', 'Loafers', 'Shoes', 'Sneakers'] as const;

/**
 * Trim verbose AI piece names to the core visual description.
 * Strips trailing "with X" / "— X" / "featuring X" clauses, then caps at 8 words
 * (increased from 6 to preserve fit adjectives: tailored, slim-cut, wide-leg, etc.)
 * Only used for supporting pieces (keyPieces, shoes, accessories) — NOT the anchor.
 */
function shortenPieceName(name: string): string {
  const stripped = name.split(/\s+with\s+|\s+—\s+|\s+featuring\s+/i)[0] ?? name;
  const words = stripped.trim().split(/\s+/);
  return words.slice(0, 8).join(' ');
}

/**
 * Produces the prompt token for a single piece.
 * Prepends metadata.color so the color word leads the token, preventing the model
 * from inheriting color from the dominant anchor item instead of the piece's own spec.
 */
function pieceLabel(piece: OutfitPieceDto): string {
  const shortened = shortenPieceName(piece.display_name);
  const color = piece.metadata?.color ?? '';
  if (color && !shortened.toLowerCase().startsWith(color.toLowerCase())) {
    return `${color} ${shortened}`;
  }
  return shortened;
}

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' | 'above' {
  // Footwear that ends up in the accessories array must still render ON the figure.
  const category = piece.metadata?.category ?? '';
  if ((FOOTWEAR_CATEGORIES as readonly string[]).includes(category)) return 'worn';

  const cat = category.toLowerCase();
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
    `single garment on headless dress form, no head no face, preserve all construction details, ` +
    `fine-line hand-drawn ink contour sketch, slight line-weight variation, soft transparent watercolor wash fill with visible pigment variation, ` +
    `loose watercolor bleed at garment edges, matte paper finish, warm aged parchment background, antique paper tone, ` +
    `muted desaturated editorial palette, no gradient, no vignette`
  );
}


const FIT_TENDENCY_FIGURE_DESCRIPTIONS: Record<string, string> = {
  tight_chest_loose_below:
    'fit tendency: broad chest and shoulders with fabric taut across the upper chest and arms, shirt or jacket appears strained slightly at the chest seams, fabric relaxes and drapes with extra volume through the midsection and below the waist',
  loose_chest_tight_below:
    'fit tendency: narrower upper body with modest shoulder width, shirt or jacket draping with extra volume through the torso, fuller and more defined thighs with fabric pulling close through the lower body',
};

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
  bodyTypeDescription?: string;
  fitTendency?: string | null;
  fitPreference?: string | null;
}) {
  const tier = input.tierLabel.toLowerCase();

  // Anchor: use the raw input verbatim — NOT shortenPieceName() (which caps at 6 words
  // and would strip silhouette-defining detail from the anchor description).
  // This is either the OpenAI vision-derived structural description from
  // describeAnchorForSketch, or the plain-text anchorItemDescription as fallback.
  const anchor = input.anchorItemDescription.trim();

  // Split keyPieces into outerwear and non-outerwear.
  // Outerwear gets its own labeled slot (outermost layer) so the model understands
  // layering order. When the anchor is a mid-layer (sweater, hoodie, etc.) and
  // outerwear is present, the anchor lock is reframed as "inner layer" to prevent
  // the model from rendering the mid-layer anchor as the outermost visible garment.
  const allKeyPieces = input.recommendation.keyPieces.slice(0, 4);
  const outerwearPieces = allKeyPieces.filter(isOuterwear);
  const remainingKeyPieces = allKeyPieces.filter((p) => !isOuterwear(p));

  const hasOuterwear = outerwearPieces.length > 0;
  const anchorMidLayer = anchorIsMidLayer(anchor);
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

  const keyPiecesStr = remainingKeyPieces.map(pieceLabel).filter(Boolean).join(', ');
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

  // "styled with the look" avoids "beside" which diffusion models interpret as
  // ground placement (flat-lay). No fallback — omit entirely when none present.
  const besidePart = besideAccessories.length > 0
    ? `${besideAccessories.join(', ')} styled with the look`
    : null;

  const abovePart = aboveAccessories.length > 0
    ? `${aboveAccessories.join(', ')} floating above the figure`
    : null;

  // Anchor locking: declared first, in the highest-weight token position.
  // When the anchor is a mid-layer (sweater, hoodie, etc.) AND outerwear is present,
  // reframe as "inner layer" so the model doesn't render the sweater as the outermost
  // garment and suppress or misplace the outerwear piece.
  const anchorLock = hasOuterwear && anchorMidLayer
    ? `inner layer worn: ${anchor}, preserve garment category and all construction details exactly, render all pockets seams hardware and structural features fully visible, worn under outerwear`
    : `anchor item worn: ${anchor}, preserve garment category and all construction details exactly, render all pockets seams hardware and structural features fully visible`;

  // Outerwear gets its own explicit slot immediately after the anchor lock.
  // Positioned here (high token weight) so the model registers the layering order:
  // anchor/inner layers → outerwear → the figure reads as fully dressed.
  const outerwearPart = hasOuterwear
    ? `outerwear outermost layer: ${outerwearPieces.map(pieceLabel).join(', ')}, worn over all inner layers`
    : null;

  const bodyTypeDescription = input.bodyTypeDescription ?? 'average build, medium frame, moderate proportions';
  const fitTendencyClause = input.fitTendency ? FIT_TENDENCY_FIGURE_DESCRIPTIONS[input.fitTendency] : null;
  const fitPreferenceClause = input.fitPreference === 'tailored'
    ? 'tailored close-fitting silhouette throughout'
    : input.fitPreference === 'relaxed' || input.fitPreference === 'oversized'
      ? 'relaxed easy silhouette throughout'
      : null;
  const figureProportionsPart = [
    bodyTypeDescription,
    'render with these proportions throughout, this defines the base figure',
    fitTendencyClause,
    fitPreferenceClause,
  ].filter(Boolean).join(', ');

  return [
    // ── Headless constraint: OPENING — slot 0, hardcoded, cannot be omitted ──────
    // Uses periods (hard semantic boundary in CLIP) and object-framing ("mannequin",
    // "dress form") rather than anatomy-negation language. Object priors prevent the
    // model from activating a full-human rendering prior before any other token fires.
    HEADLESS_OPENING,
    figureProportionsPart,
    'single headless figure, no head no face, no facial features, full-length fashion illustration, complete figure visible from shoulders to feet, full pants length visible, shoes fully visible at bottom of frame, feet touching ground, no cropping at ankles or feet',
    anchorLock,
    outerwearPart,
    keyPiecesPart,
    shoesPart,
    wornPart,
    besidePart,
    abovePart,
    // Body type reinforcement — repeated near end to counteract style-block dilution
    // of the figureProportionsPart. First clause only (max 8 words) to avoid
    // over-counting tokens, but enough to re-anchor body size before rendering.
    bodyTypeDescription.split(',').slice(0, 2).join(','),
    // ── Headless constraint: CLOSING — hardcoded reminder before style block ──────
    HEADLESS_CLOSING,
    // Style block — placed last so it modifies the full outfit description rather
    // than competing with the anchor lock in the high-weight leading tokens.
    // For the fal LoRA path this reinforces the trigger-word style toward softer
    // hand-rendered output; for Imagen this supplements its own style prefix.
    'fine-line hand-drawn ink contour sketch, slight line-weight variation and gentle roughness in outlines, ' +
    'soft transparent watercolor wash fills with visible pigment variation across fabric surfaces, ' +
    'loose watercolor bleed at garment edges, dry-brush texture on shadow folds, ' +
    'matte paper finish throughout, pigment absorbed into paper grain, no gloss no sheen on any surface, ' +
    'warm aged parchment background with loose translucent watercolor wash clouds, antique paper tone, ' +
    'muted desaturated editorial palette, soft organic edges not crisp digital lines',
  ]
    .filter(Boolean)
    .join(', ');
}
