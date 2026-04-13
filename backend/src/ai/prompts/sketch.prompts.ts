import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

/**
 * Headless constraint — hardcoded at module level so it is structurally impossible
 * to construct a sketch prompt without it. Never passed as a parameter.
 *
 * OPENING uses periods (hard CLIP semantic boundary). Avoids "mannequin" and
 * "dress form" which activate an oval/egg-shaped store-display head prior in
 * diffusion models. "Clothed figure" + explicit empty-air-above-collar language
 * establishes a wearing body without triggering the mannequin head shape.
 *
 * CLOSING reinforces after all garment tokens have fired, preventing style-block
 * dilution from overriding the opening constraint near the end of the sequence.
 */
const HEADLESS_OPENING =
  'Headless clothed figure only. No head. No face. No hair. No neck above the collar line. The collar ends in open air — no oval, no egg shape, no sphere, no stump above the collar. Fashion illustration of a clothed human figure with the head absent.';

const HEADLESS_CLOSING =
  'Headless figure only — absolutely no head, face, eyes, nose, mouth, ears, hair, or any head-shaped form above the collar anywhere in the image. The collar ends in empty air.';

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
 * Accessories are split: worn-on-body (belt, watch, tie) vs beside-figure (bags) vs omitted
 * (hats and glasses — cannot render on a headless figure).
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
  // Knitwear
  'sweater', 'pullover', 'quarter zip', 'half zip', 'jumper',
  'sweatshirt', 'hoodie', 'cardigan', 'knitwear', 'turtleneck', 'crewneck',
  // Shirts and tops — always mid-layers when outerwear is present
  'shirt', 't-shirt', 'polo', 'button-down',
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
 * Returns an explicit garment-category declaration for the anchor lock token.
 * Names the garment type AND the common wrong substitutes to prohibit, preventing
 * the image model from replacing the anchor with a tier-appropriate archetype
 * (e.g. quarter-zip pullover → bomber jacket under "Smart Casual" pressure).
 */
function categoryHint(anchor: string): string {
  const a = anchor.toLowerCase();
  if (/quarter.?zip|half.?zip/.test(a))
    return 'knit quarter-zip pullover (soft knitwear with a short zip at the centre-front collar, approximately 10 cm zip length, funnel or mock neck with the zip pull visible at the top — NOT a turtleneck, NOT a full roll collar, NOT a crew neck, NOT a jacket, NOT a bomber jacket, NOT a chore coat, NOT outerwear)';
  if (/pullover|sweater|knitwear|jumper/.test(a))
    return 'knit pullover (soft knitwear — NOT a jacket, NOT outerwear)';
  if (/crewneck/.test(a))
    return 'crewneck sweatshirt or sweater (round-neck top — NOT a jacket)';
  if (/turtleneck/.test(a))
    return 'turtleneck (high-neck knit top — NOT a jacket)';
  if (/hoodie/.test(a))
    return 'hoodie (jersey sweatshirt with hood — NOT a jacket)';
  if (/sweatshirt/.test(a))
    return 'sweatshirt (soft jersey top — NOT a jacket)';
  if (/cardigan/.test(a))
    return 'cardigan (open-front knitwear — NOT a blazer, NOT a jacket)';
  if (/dress shirt|button.?down|oxford/.test(a))
    return 'woven dress shirt (collared woven shirt, base layer — NOT a jacket, NOT a blazer, NOT outerwear)';
  if (/shirt/.test(a))
    return 'woven shirt (collared shirt, base layer — NOT a jacket, NOT outerwear)';
  if (/t-shirt|tee\b/.test(a))
    return 'T-shirt (jersey top, base layer — NOT a jacket)';
  if (/polo/.test(a))
    return 'polo shirt (collared jersey top — NOT a blazer, NOT a jacket)';
  return 'garment exactly as described above — do not substitute garment category';
}

/**
 * Accessories that are worn ON the body and should be visible in the sketch.
 */
const WORN_ACCESSORY_KEYWORDS = [
  'belt', 'watch', 'tie', 'scarf', 'pocket square', 'bracelet', 'necklace',
  'ring', 'suspenders', 'cufflinks',
];

/**
 * Accessories that must be omitted from the sketch entirely.
 * Hats cannot float convincingly above a headless figure (no reference point).
 * Glasses/sunglasses cannot be worn on a headless figure and "styled with the look"
 * still causes them to float mid-prompt with no anchor point.
 */
const OMIT_ACCESSORY_KEYWORDS = [
  'hat', 'cap', 'beanie', 'fedora', 'beret', 'bucket hat', 'snapback', 'baseball cap',
  'sunglasses', 'glasses',
];

/**
 * Accessories that are placed beside the figure (bags).
 * These are rendered as "styled with the look" rather than "beside" to avoid
 * flat-lay ground placement in the generated sketch.
 */
const BESIDE_ACCESSORY_KEYWORDS = [
  'bag', 'tote', 'backpack', 'briefcase', 'umbrella', 'gloves',
];

/**
 * Footwear schema categories — always rendered ON the figure, never beside or above.
 * Prevents loafers/boots in the accessories array from appearing as flat-lay props.
 */
const FOOTWEAR_CATEGORIES = ['Boots', 'Loafers', 'Shoes', 'Sneakers'] as const;

/**
 * Trim verbose AI piece names to the core visual description.
 * Preserves "with X" / "featuring X" clauses when the clause describes a structural
 * feature (pockets, hardware, zips, etc.) — stripping these removes visually defining
 * details (e.g. "cargo pants with large side cargo pockets" → "cargo pants").
 * "— X" clauses are always stripped (styling notes, not structural).
 * Only used for supporting pieces (keyPieces, shoes, accessories) — NOT the anchor.
 */
function shortenPieceName(name: string): string {
  const STRUCTURAL_FEATURE = /pocket|zip|button|buckle|strap|lace|hook|panel|patch|pleat|cuff|collar|hardware|seam/i;
  // Strip "— X" styling notes entirely, then split on "with" / "featuring"
  const withoutDash = name.split(/\s+—\s+/)[0] ?? name;
  const parts = withoutDash.split(/\s+(?:with|featuring)\s+/i);
  const kept = parts.reduce<string[]>((acc, part, i) => {
    if (i === 0) { acc.push(part); return acc; }
    // Re-attach only clauses that name structural features
    if (STRUCTURAL_FEATURE.test(part)) acc.push(`with ${part}`);
    return acc;
  }, []);
  const words = kept.join(' ').trim().split(/\s+/);
  // Cap at 10 to preserve fit adjectives AND a kept structural clause
  return words.slice(0, 10).join(' ');
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

function classifyAccessory(piece: OutfitPieceDto): 'worn' | 'beside' | 'omit' {
  // Footwear that ends up in the accessories array must still render ON the figure.
  const category = piece.metadata?.category ?? '';
  if ((FOOTWEAR_CATEGORIES as readonly string[]).includes(category)) return 'worn';

  const cat = category.toLowerCase();
  const name = piece.display_name.toLowerCase();
  const haystack = `${cat} ${name}`;

  // Hats and glasses cannot render on a headless figure — omit entirely.
  if (OMIT_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'omit';
  if (WORN_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'worn';
  if (BESIDE_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))) return 'beside';
  return 'beside';
}

export function buildClosetItemSketchPrompt(input: { itemDescription: string }) {
  return [
    'Create a menswear editorial fashion illustration of a single garment on a clean presentation.',
    'Visual style: luxury menswear sketch, hand-rendered marker and watercolor wash, confident ink outlines, refined retail lookbook presentation.',
    'Show only this one piece — do not add other garments, people, or accessories.',
    'Do not add any words, logos, watermarks, UI chrome, or marketing copy.',
    'Favor a soft neutral or white background with premium menswear presentation.',
    `Garment: ${input.itemDescription}`,
    'Compose this as a polished portrait-oriented single-piece menswear sketch suitable for a premium wardrobe cataloguing app.',
  ].join('\n');
}

/**
 * Product-only prompt for non-sunglasses accessories (bags, watches, belts, hats, etc.)
 * intended for OpenAI gpt-image-1 — no LoRA trigger word needed.
 */
export function buildAccessorySketchPrompt(input: { itemDescription: string }) {
  return (
    `Fashion illustration of ${input.itemDescription.trim()} displayed as a standalone product. ` +
    `No figure, no mannequin, no body, no hands, no person. ` +
    `Item shown alone floating on a warm aged parchment background. ` +
    `Fine-line hand-drawn ink contour sketch with slight line-weight variation, ` +
    `soft transparent watercolor wash fill with visible pigment variation, ` +
    `matte paper finish, muted desaturated editorial palette.`
  );
}

/**
 * Product-only prompt for sunglasses intended for OpenAI gpt-image-1.
 * No LoRA trigger word — OpenAI follows product-only instructions reliably.
 */
export function buildSunglassesOpenAiPrompt(input: {
  itemDescription: string;
  lensShape?: string | null;
  frameColor?: string | null;
}) {
  const framePart = input.frameColor ? `${input.frameColor}-frame` : null;
  const lensPart = input.lensShape ? `${input.lensShape.replace('_', '-')} lenses` : null;

  const descriptor = [input.itemDescription.trim(), framePart, lensPart].filter(Boolean).join(', ');

  return (
    `Fashion illustration of ${descriptor} displayed as a standalone product. ` +
    `No figure, no mannequin, no body, no hands, no person. ` +
    `Sunglasses shown alone, front-facing at a slight angle so both lenses and the full frame are clearly visible. ` +
    `Floating on a warm aged parchment background. ` +
    `Fine-line hand-drawn ink contour sketch with slight line-weight variation, ` +
    `soft transparent watercolor wash fill with visible pigment variation across lenses and frame, ` +
    `matte paper finish, muted desaturated editorial palette.`
  );
}

export function buildSunglassesSketchPrompt(input: {
  itemDescription: string;
  lensShape?: string | null;
  frameColor?: string | null;
}) {
  const framePart = input.frameColor ? `${input.frameColor} frame` : null;
  const lensPart = input.lensShape ? `${input.lensShape.replace('_', '-')} lenses` : null;

  return [
    input.itemDescription.trim(),
    framePart,
    lensPart,
    'product only, no figure, no mannequin, no body, no person, no hands',
    'sunglasses displayed alone on neutral background',
    'front-facing at slight angle so both lenses and full frame are visible',
    'fine-line hand-drawn ink contour sketch, slight line-weight variation',
    'soft transparent watercolor wash fill, matte paper finish',
    'warm aged parchment background, muted desaturated editorial palette',
  ].filter(Boolean).join(', ');
}


const ANCHOR_COLOR_WORDS = [
  'navy', 'black', 'white', 'grey', 'gray', 'brown', 'camel', 'tan', 'beige', 'cream', 'ivory',
  'charcoal', 'khaki', 'olive', 'green', 'blue', 'red', 'burgundy', 'wine', 'maroon',
  'orange', 'yellow', 'pink', 'purple', 'violet', 'indigo', 'teal', 'coral',
  'rust', 'terracotta', 'mustard', 'ecru', 'slate', 'stone', 'sand', 'cobalt',
  'off-white', 'forest green', 'dark blue', 'light blue', 'pale blue', 'royal blue',
];

/**
 * Extracts the first recognisable color word from an anchor description.
 * Used to pin the anchor color explicitly in the anchorLock token so the model
 * cannot drift to a tier-default hue (e.g. navy → charcoal under "Business" pressure).
 */
function extractAnchorColor(description: string): string | null {
  const d = description.toLowerCase();
  // Multi-word colors checked first (longer match wins)
  for (const color of ANCHOR_COLOR_WORDS) {
    if (d.includes(color)) return color;
  }
  return null;
}

/**
 * Detects surface patterns in an anchor description and returns an explicit
 * rendering instruction for the pattern. Prevents the model from smoothing
 * over micro-check or herringbone weaves into solid fabric.
 */
function patternHint(description: string): string | null {
  const d = description.toLowerCase();
  if (/micro.?check|glen.?check/.test(d))
    return 'micro-check pattern — fine repeating two-colour grid clearly visible across the entire fabric surface';
  if (/houndstooth/.test(d))
    return 'houndstooth pattern — broken-check two-colour weave clearly visible across fabric surface';
  if (/herringbone/.test(d))
    return 'herringbone weave — V-shaped zigzag clearly visible across fabric surface';
  if (/plaid|tartan/.test(d))
    return 'plaid/tartan pattern — intersecting coloured stripes clearly visible';
  if (/stripe|striped/.test(d))
    return 'striped pattern running along fabric surface';
  if (/check|checked/.test(d))
    return 'check pattern clearly visible across fabric surface';
  if (/tweed/.test(d))
    return 'tweed texture — visible flecked multi-tone weave across fabric surface';
  return null;
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

  // Anchor locking: declared first, in the highest-weight token position.
  // categoryHint() names the garment type and explicitly prohibits common substitutions
  // (e.g. quarter-zip → bomber jacket, dress shirt → blazer under tier pressure).
  // Color and pattern are pinned explicitly so the model cannot drift to tier-default
  // hues or smooth over micro-check/herringbone weaves into solid fabric.
  // When the anchor is a mid-layer AND outerwear is present, reframe as "inner layer"
  // so the model layers correctly and doesn't render the mid-layer as outermost.
  const anchorColor = extractAnchorColor(anchor);
  const anchorPattern = patternHint(anchor);
  const anchorColorClause = anchorColor
    ? ` Render the anchor in ${anchorColor} — preserve this exact color, do not substitute with a tier-default hue.`
    : '';
  const anchorPatternClause = anchorPattern
    ? ` Pattern: ${anchorPattern} — render this explicitly on the anchor fabric surface, do not simplify to solid.`
    : '';

  const anchorLock = hasOuterwear && anchorMidLayer
    ? `ANCHOR INNER LAYER — must be rendered exactly as described, visible under outerwear: ${anchor}. ` +
      `This is a ${categoryHint(anchor)}, worn under the outermost layer. ` +
      `Preserve exact collar type, closure mechanism, fabric, and all structural details.` +
      anchorColorClause + anchorPatternClause
    : `ANCHOR PIECE — this garment is non-negotiable: ${anchor}. ` +
      `This is a ${categoryHint(anchor)}. ` +
      `Do not replace, substitute, or change this garment. Preserve category, collar, closure, and construction exactly.` +
      anchorColorClause + anchorPatternClause;

  // Outerwear gets its own explicit slot immediately after the anchor lock.
  // Positioned here (high token weight) so the model registers the layering order:
  // anchor/inner layers → outerwear → the figure reads as fully dressed.
  const outerwearPart = hasOuterwear
    ? `outerwear outermost layer: ${outerwearPieces.map(pieceLabel).join(', ')}, worn over all inner layers`
    : null;

  // Color contrast guard: when anchor and outerwear differ in color, declare both
  // colors explicitly so the anchor's color cannot bleed into the outerwear layer.
  const outerwearColor = outerwearPieces[0]?.metadata?.color?.toLowerCase() ?? '';
  const anchorColorWord = anchor.split(/[\s,]/)[0]?.toLowerCase() ?? '';
  const colorContrastClause =
    hasOuterwear && outerwearColor && anchorColorWord && outerwearColor !== anchorColorWord
      ? `color distinction — anchor is ${anchorColorWord}, outerwear is ${outerwearColor}: render each layer in its own specified color, do not transfer anchor color to outerwear`
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

  // Single-figure composition constraint — all garments on the figure, no flat-lay or split.
  const compositionInstruction =
    'ALL listed garments must be shown ON the single figure as a complete worn outfit — no floating items, no flat lay, no second figure, no garments beside or behind the figure';

  return [
    // ── Headless constraint: OPENING — slot 0, hardcoded, cannot be omitted ──────
    // Uses periods (hard semantic boundary in CLIP) and "clothed figure" framing —
    // NOT "mannequin"/"dress form" which triggers oval store-display head priors.
    HEADLESS_OPENING,
    figureProportionsPart,
    'single headless figure, no head no face, no facial features, full-length fashion illustration, complete figure visible from shoulders to feet, full pants length visible, shoes fully visible at bottom of frame, feet touching ground, no cropping at ankles or feet',
    anchorLock,
    outerwearPart,
    colorContrastClause,
    keyPiecesPart,
    shoesPart,
    compositionInstruction,
    wornPart,
    besidePart,
    // Body type reinforcement — repeated near end to counteract style-block dilution
    // of the figureProportionsPart. First clause only (max 8 words) to avoid
    // over-counting tokens, but enough to re-anchor body size before rendering.
    bodyTypeDescription.split(',').slice(0, 2).join(','),
    // Style block — placed before closing headless reminder so all garment tokens
    // register before the style modifier fires.
    'fine-line hand-drawn ink contour sketch, slight line-weight variation and gentle roughness in outlines, ' +
    'soft transparent watercolor wash fills with visible pigment variation across fabric surfaces, ' +
    'loose watercolor bleed at garment edges, dry-brush texture on shadow folds, ' +
    'matte paper finish throughout, pigment absorbed into paper grain, no gloss no sheen on any surface, ' +
    'warm aged parchment background with loose translucent watercolor wash clouds, antique paper tone, ' +
    'muted desaturated editorial palette, soft organic edges not crisp digital lines',
    // ── Headless constraint: CLOSING — last token position, reinforces after all
    // style and garment tokens have fired, preventing late-sequence face generation ──
    HEADLESS_CLOSING,
  ]
    .filter(Boolean)
    .join(', ');
}
