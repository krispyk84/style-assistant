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
  'The figure should be a sleek fashion mannequin shown from the shoulders downward only, cropped at the top of the shoulders with no head shown, front-facing, full-length, tall and well-proportioned, with a soft atmospheric wash behind the figure that matches the watercolor paper treatment. ' +
  'CRITICAL COMPOSITION RULE: scale and position the figure so that the entire body fits within the canvas — both feet and the full shoe silhouette must be completely visible with clear empty space below them. Never crop, clip, or cut off the feet or ankles. The shoes must be fully rendered and sitting well above the bottom edge of the image. ' +
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
// Four-part structure matching the outfit sketch system:
// Part 1: CLOSET_ITEM_STYLE_PREAMBLE (fixed visual language)
// Part 2: Item block (dynamic — built per item)
// Part 3: CLOSET_ITEM_QUALITY_ADDENDUM (rendering quality + color fidelity)
// Part 4: CLOSET_ITEM_COMPOSITION_RULES (framing + category-specific layout)

const CLOSET_ITEM_STYLE_PREAMBLE =
  'Create a consistent editorial menswear fashion illustration in the exact same visual language across generations. ' +
  'Use an atmospheric hand-rendered watercolor sketch treatment throughout. ' +
  'The background must be a warm off-white watercolor paper field with visible paper grain, soft beige-gray wash, uneven transparency, subtle pigment blooms, faint edge staining, cloudy tonal variation, and loose brush residue around the subject — never a flat white or clean digital background. ' +
  'The linework should feel organic and slightly imperfect: scratchy graphite-and-ink contours, light hand jitter, and softly broken outlines rather than crisp polished edges. ' +
  'Apply transparent layered watercolor fills with rich, accurate garment color and gentle pooling and bleeding of pigment at folds, seams, edges, and shadow areas. ' +
  'Fabric textures, weave patterns, stitching, hardware, sole construction, watch case structure, and material sheen should be rendered with high fidelity. ' +
  'The overall image must be tactile, painterly, and editorial — like a luxury stylist\'s sketchbook page. ' +
  'Avoid vector cleanliness, sterile negative space, hard digital edges, glossy rendering, flat color blocking, cartoon polish, or overly neat app-illustration treatment. ' +
  'The subject is a single closet item, not a full outfit. Render one isolated wardrobe item as the primary focus, centered and scaled large in frame, with a small amount of breathing room around it. ' +
  'The item should feel elevated, collectible, and fashion-editorial. ' +
  'Keep the same luxury menswear watercolor-paper aesthetic as the outfit sketches so the closet-item image and outfit image belong to the exact same visual system.';

const CLOSET_ITEM_QUALITY_ADDENDUM =
  'Push the rendering away from simple illustration and toward a more elevated, fashion-editorial watercolor product sketch. ' +
  'Make the subject feel luxurious, stylish, modern, and highly considered while staying completely true to the provided item. ' +
  'Increase color fidelity: the item must match the real product color as accurately as possible, prioritizing exact hue, depth, temperature, undertone, and saturation rather than drifting toward generic beige, tan, gray, or muted neutrals. ' +
  'Do not reinterpret the item\'s color; preserve it faithfully. ' +
  'Increase richness and vibrancy slightly while keeping the palette refined and believable so the item feels alive rather than washed out. ' +
  'Add more material realism and construction detail: show seam lines, stitch density, plackets, ribbing, zipper hardware, pull tabs, welt edges, sole shape, leather paneling, laces, buckle form, crown shape, bracelet links, case details, and subtle surface grain with precision. ' +
  'Use layered transparent watercolor, nuanced shadowing, tonal variation, tactile surface detail, and realistic light falloff so the object feels luxurious and dimensional, not flat or overly illustrated. ' +
  'Keep the hand-drawn editorial line quality and watercolor-paper background, but make the final result feel closer to a high-end fashion concept sketch or luxury menswear product board than a simplified catalog illustration. ' +
  'Avoid color drift, generic neutralization, flat fills, cartoon cleanliness, overly soft simplification, or loss of product-specific detail.';

const CLOSET_ITEM_COMPOSITION_RULES =
  'The single item must always be fully visible in frame and never cropped. Leave a small margin around the subject so the entire silhouette is clearly shown. Scale the subject generously so it feels prominent and editorial, but do not let any edge touch or cross the frame boundary. ' +
  'Use category-appropriate composition: ' +
  'Tops, shirts, jackets, knitwear: render front-facing, symmetrical, isolated, floating naturally, with realistic shoulder shape and garment drape. No body, no face, no mannequin stand; the piece should read like a luxury product sketch suspended on paper. ' +
  'Trousers: render front-facing and full-length, centered, with waistband, rise, leg shape, hem, and crease structure clearly visible. ' +
  'Shoes: render either as a single hero shoe in elegant 3-quarter view or as a pair in a clean editorial arrangement, depending on the item description. Preserve accurate last shape, sole thickness, stitching lines, and material finish. ' +
  'Watches: render as a centered hero product sketch with accurate case shape, dial proportions, markers, crown guard, bracelet or strap construction, and reflective material behavior, while keeping the watercolor treatment intact. ' +
  'Bags and accessories: render isolated and centered with realistic structure, handle shape, edge paint, stitching, hardware, and material depth. ' +
  'Sunglasses: render cleanly with accurate frame shape, lens tint, hinge placement, and subtle reflections, while preserving the hand-rendered watercolor-paper aesthetic. ' +
  'Keep the subject fashion-editorial rather than e-commerce plain. ' +
  'The final image should feel like a luxury stylist\'s product sketch page in the same universe as the outfit illustrations. ' +
  'Render this as a collectible editorial product sketch in the exact same watercolor-paper style system as the outfit illustrations, with the item isolated, fully visible, color-accurate, and materially specific.';

export type ClosetItemSketchInput = {
  category: string;
  type: string;
  color: string;
  material?: string | null;
  silhouette?: string | null;
  details?: string | null;
  orientation?: string | null;
  stylingNotes?: string | null;
};

export function buildClosetItemSketchPrompt(input: ClosetItemSketchInput): string {
  const itemLines = [
    `- category: ${input.category}`,
    `- type: ${input.type}`,
    `- color: ${input.color}`,
    input.material ? `- material: ${input.material}` : null,
    input.silhouette ? `- silhouette: ${input.silhouette}` : null,
    input.details ? `- details: ${input.details}` : null,
    input.orientation ? `- orientation: ${input.orientation}` : null,
    input.stylingNotes ? `- styling notes: ${input.stylingNotes}` : null,
  ].filter(Boolean).join('\n');

  return `${CLOSET_ITEM_STYLE_PREAMBLE}\n\nItem:\n${itemLines}\n\n${CLOSET_ITEM_QUALITY_ADDENDUM}\n\n${CLOSET_ITEM_COMPOSITION_RULES}`;
}

/**
 * @deprecated Use buildClosetItemSketchPrompt with a ClosetItemSketchInput instead.
 * Kept temporarily so the accessory and sunglasses branches in closet-sketch.service.ts
 * can be migrated without a simultaneous deploy.
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

// ── Outfit quality addendum ───────────────────────────────────────────────────
// Appended after the outfit bullet list to push rendering quality and fidelity.

const QUALITY_ADDENDUM =
  'Push the rendering away from simple illustration and toward a more elevated, fashion-editorial watercolor sketch. ' +
  'Make the outfit feel more stylish, directional, and modern, with sharper taste, stronger styling, and more confident silhouette choices while staying true to the provided garments. ' +
  'Increase color fidelity: the anchor piece and every described clothing item must match the real garment color as accurately as possible, prioritizing the exact hue, depth, temperature, and saturation of the source item rather than drifting toward generic beige, tan, or muted neutrals. ' +
  'Do not reinterpret the anchor item\'s color; preserve it faithfully. ' +
  'Increase richness and vibrancy slightly while keeping the palette refined and believable, so the image feels alive rather than washed out. ' +
  'Add more garment detail and material realism: show seam lines, ribbing, stitch lines, plackets, pocket construction, zipper hardware, fabric grain, creases, drape, cuff structure, collar shape, sole detail, and small accessory details with subtle precision. ' +
  'Use layered transparent watercolor, nuanced shadowing, tonal variation, and tactile surface detail so the garments feel luxurious and dimensional, not flat or overly illustrated. ' +
  'Keep the hand-drawn editorial line quality and watercolor-paper background, but make the final result feel closer to a high-end fashion concept sketch or luxury menswear style board than a simplified app illustration. ' +
  'Avoid color drift, generic neutralization, flat fills, cartoon cleanliness, overly soft simplification, or loss of garment-specific detail.';

const QUALITY_ADDENDUM_2 =
  'Increase the level of garment and accessory detail while preserving the hand-rendered editorial watercolor style. ' +
  'Show more construction and material information: seam placement, topstitching, rib knit texture, zipper teeth and puller, pocket welts, plackets, collar structure, cuff shape, waistband finish, belt hardware, shoe panels, laces, sole edges, watch case detail, and subtle fabric grain. ' +
  'Make the colors slightly richer and more vibrant while staying refined and believable, with stronger tonal contrast and clearer color separation between garments so the outfit feels more fashion-forward, polished, and visually alive. ' +
  'Preserve accurate color fidelity to the source garments, especially the anchor piece, matching the true hue, saturation, undertone, and value rather than drifting toward generic tan or beige. ' +
  'Keep the watercolor-paper background and organic hand-drawn line quality, but add more nuanced shading, layered washes, and tactile surface variation so the image feels closer to a high-end fashion concept sketch than a simplified illustration. ' +
  'The full figure must always be visible from the shoulder opening down to the shoes — both feet completely in frame, never cropped, never cut off, never at the very edge. Scale the figure smaller if needed to ensure the complete shoe silhouette is shown with visible empty space below it. This is a strict layout requirement: do not let the feet touch or exceed the bottom boundary of the image.';

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

  return `${STYLE_PREAMBLE}\n\nOutfit:\n${outfitLines.join('\n')}\n\n${QUALITY_ADDENDUM}\n\n${QUALITY_ADDENDUM_2}`;
}
