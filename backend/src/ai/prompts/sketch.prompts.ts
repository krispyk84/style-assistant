import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

// ── Outfit sketch style preamble ──────────────────────────────────────────────
// Fixed across all generations to enforce visual consistency.
// Part 1 of the two-part prompt structure: style + figure + composition.
// Part 2 is the dynamic outfit description built by buildTierSketchPrompt.

const STYLE_PREAMBLE =
  'Create a consistent editorial menswear fashion illustration in the exact same visual language across generations. ' +
  'Use a atmospheric hand-rendered watercolor sketch treatment throughout. ' +
  'The background must be a warm off-white watercolor paper field with visible paper grain, soft beige-gray wash, uneven transparency, subtle pigment blooms, faint edge staining, cloudy tonal variation, and loose brush residue around the figure and accessories — never a flat white or clean digital background. ' +
  'The linework should feel organic and slightly imperfect: scratchy graphite-and-ink contours, light hand jitter, and softly broken outlines rather than crisp polished edges. ' +
  'Apply transparent layered watercolor fills with rich saturated garment colors at full chroma — no desaturation — with gentle pooling and bleeding of pigment at folds, hems, and shadow areas. ' +
  'Fabric textures, weave patterns, stitching details, hardware, and material sheen should be rendered with high fidelity. ' +
  'The figure should be a sleek headless fashion mannequin — no head, no neck, torso begins at the shoulders — front-facing, full-length, tall and well-proportioned, with a soft atmospheric wash behind the figure that matches the watercolor paper treatment. ' +
  'Garments should drape and fold naturally with realistic tailoring weight, precise collar construction, pocket placement, and button details clearly visible. ' +
  'Accessories, if present, should appear as neatly separated callout objects to the side, rendered with the same hand-rendered material detail. ' +
  'The overall image must be tactile, painterly, and editorial — like a luxury stylist\'s sketchbook page. ' +
  'Avoid vector cleanliness, sterile negative space, hard digital edges, glossy rendering, flat color blocking, or overly neat app-illustration polish.';

// ── Outerwear / mid-layer detection ──────────────────────────────────────────

const OUTERWEAR_KEYWORDS = [
  'blazer', 'jacket', 'coat', 'overcoat', 'topcoat', 'trench', 'parka',
  'anorak', 'peacoat', 'chore coat', 'bomber', 'windbreaker', 'sport coat',
  'suit jacket', 'fleece jacket', 'down jacket', 'quilted jacket',
];

const MIDLAYER_ANCHOR_KEYWORDS = [
  'sweater', 'pullover', 'quarter zip', 'half zip', 'jumper',
  'sweatshirt', 'hoodie', 'cardigan', 'knitwear', 'turtleneck', 'crewneck',
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

// ── Piece name helpers ────────────────────────────────────────────────────────

/**
 * Trim verbose AI piece names to the core visual description.
 * Preserves "with X" clauses that name structural features (pockets, hardware, etc.).
 */
function shortenPieceName(name: string): string {
  const STRUCTURAL_FEATURE = /pocket|zip|button|buckle|strap|lace|hook|panel|patch|pleat|cuff|collar|hardware|seam/i;
  const withoutDash = name.split(/\s+—\s+/)[0] ?? name;
  const parts = withoutDash.split(/\s+(?:with|featuring)\s+/i);
  const kept = parts.reduce<string[]>((acc, part, i) => {
    if (i === 0) { acc.push(part); return acc; }
    if (STRUCTURAL_FEATURE.test(part)) acc.push(`with ${part}`);
    return acc;
  }, []);
  return kept.join(' ').trim().split(/\s+/).slice(0, 10).join(' ');
}

/**
 * Prepends metadata.color so the color word leads the piece token.
 */
function pieceLabel(piece: OutfitPieceDto): string {
  const shortened = shortenPieceName(piece.display_name);
  const color = piece.metadata?.color ?? '';
  if (color && !shortened.toLowerCase().startsWith(color.toLowerCase())) {
    return `${color} ${shortened}`;
  }
  return shortened;
}

// ── Anchor color / pattern fidelity ──────────────────────────────────────────
// Explicitly pin anchor color and pattern in the outfit description so the
// image model cannot drift to a tier-default hue or smooth over micro-weaves.

const ANCHOR_COLOR_WORDS = [
  'navy', 'black', 'white', 'grey', 'gray', 'brown', 'camel', 'tan', 'beige', 'cream', 'ivory',
  'charcoal', 'khaki', 'olive', 'green', 'blue', 'red', 'burgundy', 'wine', 'maroon',
  'orange', 'yellow', 'pink', 'purple', 'violet', 'indigo', 'teal', 'coral',
  'rust', 'terracotta', 'mustard', 'ecru', 'slate', 'stone', 'sand', 'cobalt',
  'off-white', 'forest green', 'dark blue', 'light blue', 'pale blue', 'royal blue',
];

function extractAnchorColor(description: string): string | null {
  const d = description.toLowerCase();
  for (const color of ANCHOR_COLOR_WORDS) {
    if (d.includes(color)) return color;
  }
  return null;
}

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

// ── Closet item sketch prompts ────────────────────────────────────────────────

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

// ── Outfit tier sketch prompt ─────────────────────────────────────────────────

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
  gender?: string | null;
  bodyTypeDescription?: string;
  fitTendency?: string | null;
  fitPreference?: string | null;
}) {
  const anchor = input.anchorItemDescription.trim();

  const allKeyPieces = input.recommendation.keyPieces.slice(0, 4);
  const outerwearPieces = allKeyPieces.filter(isOuterwear);
  const remainingKeyPieces = allKeyPieces.filter((p) => !isOuterwear(p));
  const hasOuterwear = outerwearPieces.length > 0;
  const anchorMidLayer = anchorIsMidLayer(anchor);

  // Anchor color and pattern — pinned explicitly to prevent drift
  const anchorColor = extractAnchorColor(anchor);
  const anchorPattern = patternHint(anchor);
  const anchorDetail = [
    anchorColor ? `color: ${anchorColor}` : null,
    anchorPattern ? `pattern: ${anchorPattern}` : null,
  ].filter(Boolean).join(', ');
  const anchorSuffix = anchorDetail ? ` (${anchorDetail})` : '';

  // Build the outfit bullet list
  const outfitLines: string[] = [];

  if (hasOuterwear && anchorMidLayer) {
    outfitLines.push(`- inner layer (anchor): ${anchor}${anchorSuffix}`);
    outfitLines.push(`- outerwear (worn over anchor): ${outerwearPieces.map(pieceLabel).join(', ')}`);
  } else {
    outfitLines.push(`- anchor: ${anchor}${anchorSuffix}`);
    if (outerwearPieces.length > 0) {
      outfitLines.push(`- outerwear: ${outerwearPieces.map(pieceLabel).join(', ')}`);
    }
  }

  const remainingStr = remainingKeyPieces.map(pieceLabel).filter(Boolean).join(', ');
  if (remainingStr) {
    outfitLines.push(`- garments: ${remainingStr}`);
  }

  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel).filter(Boolean);
  if (shoes.length > 0) {
    outfitLines.push(`- shoes: ${shoes.join(', ')}`);
  }

  const accessories = input.recommendation.accessories.slice(0, 4).map(pieceLabel).filter(Boolean);
  if (accessories.length > 0) {
    outfitLines.push(`- accessories: ${accessories.join(', ')}`);
  }

  return `${STYLE_PREAMBLE}\n\nOutfit:\n${outfitLines.join('\n')}`;
}
