import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';
import type { AnchorColorMetadata } from '../../modules/outfits/anchor-description.service.js';

// ── Outfit sketch style preamble ──────────────────────────────────────────────
// Fixed across all generations to enforce visual consistency.
// Prompt assembly order (most critical first):
//   1. HEADLESS_GUARD   — establishes figure type before all else; must be slot 0
//   2. STYLE_GUARD      — locks editorial watercolor aesthetic; blocks cartoon/portrait drift
//   3. subjectBrief     — physique + skin tone (dynamic, per-user)
//   4. STYLE_PREAMBLE   — canvas framing + composition rules + background
//   5. anchorColorBlock — color lock for anchor item
//   6. outfitSection    — garment list
//   7. QUALITY_ADDENDUM — rendering quality push
//   8. QUALITY_ADDENDUM_2 — composition verification + final headless check

// Slot 0: establishes headless mannequin as the figure type before anything
// else activates human-figure rendering priors. Must be the first thing the
// model reads. A soft "no face" buried in framing instructions is ignored.
const HEADLESS_GUARD =
  'SUBJECT: headless fashion mannequin — no head — no face — no hair — no facial features — no skin above the collar. ' +
  'The mannequin is cut cleanly at the collar/neckline. Above the collar line is empty paper background only. ' +
  'Generating a head, face, hair, or any facial feature is a critical failure of this prompt. ' +
  'This is not a portrait. This is not a person. The subject has no head.';

// Slot 1: locks the visual style before any aesthetic framing takes hold.
// Prevents the model from drifting into cartoon, portrait, or anime territory.
const STYLE_GUARD =
  'STYLE: soft editorial watercolor fashion illustration on warm matte paper. ' +
  'Fine ink linework under transparent watercolor washes. Matte paper texture. Refined and sophisticated. ' +
  'NOT cartoon. NOT anime. NOT manga. NOT comic art. NOT exaggerated character illustration. ' +
  'NOT photo-realistic portrait. NOT digital concept art. NOT fashion avatar. ' +
  'The mood is quiet, elegant, and premium — like a hand-drawn page from a luxury fashion sketchbook.';

const STYLE_PREAMBLE =
  'CANVAS FRAMING: 1024×1536 portrait canvas. ' +
  'The figure — collar/neckline down to shoe soles — is centered and occupies approximately the middle 70% of the canvas height. ' +
  'The collar/neckline sits approximately 230px from the top edge. ' +
  'The shoe soles MUST be fully visible with clear empty paper below them — at least 200px from the bottom edge. Cropped ankles or invisible feet are a composition failure. ' +
  'The figure is centered horizontally with at least 80px of empty paper on both left and right sides. ' +
  'Empty paper is clearly visible above the neckline and below the shoes. The figure never touches any canvas edge. ' +
  'Editorial menswear illustration in the style of a high-end GQ or Esquire fashion lookbook. ' +
  'Richly saturated, true-to-life colors with strong contrast and depth. ' +
  'Confident, deliberate ink linework. ' +
  'Visible fabric texture on every garment — show weave on knits, sheen on nylon, grain on leather. ' +
  'Realistic stitching, seams, and hardware detail. ' +
  'Each material reads as distinct from the others. ' +
  'The overall image feels crafted and intentional, not digitally generic. ' +
  'Background: atmospheric toned-paper ground — pale ivory or near-white at the very centre, softly deepening outward into warm beige, then dusty taupe, then a richer warm gray-brown at the corners, creating a pronounced soft radial vignette. Loose transparent watercolour washes drift and bloom across the surface with visible paper grain, subtle pooling, uneven pigment saturation, soft brush residue at the edges, and faint cloud-like tonal variation throughout. The overall effect resembles naturally aged, warmly lit watercolour paper with ambient shadow gathering at the periphery — never a flat, uniform, or digitally clean fill. ' +
  'Garments drape and fold naturally with realistic tailoring weight, precise collar construction, pocket placement, and button details clearly visible. ' +
  'Accessories are rendered as a clean flat-lay beside the figure — each item fully within the canvas, clearly isolated, identifiable, and true to its described color and material.';

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

// Compound / multi-word neutrals MUST come before single-word ones so that
// "warm gray" matches before "gray" in the first-match scan.
const ANCHOR_COLOR_WORDS = [
  // compounds first
  'off-white', 'forest green', 'dark blue', 'light blue', 'pale blue', 'royal blue',
  'warm gray', 'cool gray', 'warm grey', 'cool grey', 'light gray', 'light grey',
  'warm beige', 'cool beige', 'warm taupe', 'cool taupe',
  // specific neutrals that commonly drift
  'taupe', 'greige', 'mushroom', 'oatmeal', 'putty', 'dove', 'ash', 'pebble',
  'chalk', 'bone', 'linen', 'flax', 'driftwood', 'stone', 'sand', 'ecru', 'slate',
  // standard colours
  'navy', 'black', 'white', 'grey', 'gray', 'brown', 'camel', 'tan', 'beige', 'cream', 'ivory',
  'charcoal', 'khaki', 'olive', 'green', 'blue', 'red', 'burgundy', 'wine', 'maroon',
  'orange', 'yellow', 'pink', 'purple', 'violet', 'indigo', 'teal', 'coral',
  'rust', 'terracotta', 'mustard', 'cobalt',
];

/**
 * Canonical hex codes for every recognized anchor color word.
 * Used to give the image model a precise, unambiguous color target instead of
 * relying on it to interpret a color word correctly.
 */
const ANCHOR_COLOR_HEX: Record<string, string> = {
  // fine-grain neutrals — highest drift risk; hex based on midtone fabric sampling
  taupe:          '#B8AFA6', // medium neutral gray-brown
  greige:         '#C4B8A6', // gray + beige blend, slightly warm
  mushroom:       '#BFB2A6', // warm muted gray-brown
  oatmeal:        '#D8CCBA', // warm pale beige-cream
  putty:          '#C9BDAC', // warm medium neutral
  dove:           '#D5D3CD', // cool pale gray
  ash:            '#ABABAB', // cool medium gray
  pebble:         '#9E9A94', // medium warm gray
  chalk:          '#EDE9E2', // very pale warm off-white
  bone:           '#E8E2D5', // very pale warm white
  linen:          '#E8DFCC', // warm pale ecru
  flax:           '#D9C99A', // warm light golden-beige
  driftwood:      '#B0A898', // muted warm gray-brown
  // existing neutrals
  stone:          '#C4BAB0', // cool pale gray-beige
  sand:           '#E0D0B0', // warm pale off-white beige
  ecru:           '#EFE3CC', // warm pale off-white
  slate:          '#7A8A96', // cool blue-gray
  camel:          '#C19A6B', // warm medium tan-brown
  tan:            '#D2B48C', // light warm neutral
  beige:          '#E8DCC8', // pale warm neutral
  ivory:          '#F6F0E4', // very pale warm white
  cream:          '#FFFBEF', // pale warm off-white
  'off-white':    '#FAF8F2', // near-white with warmth
  khaki:          '#C3B08A', // yellow-green muted military
  olive:          '#7A7A30', // dull yellow-green
  charcoal:       '#3A3A3A', // very dark gray
  gray:           '#888888',
  grey:           '#888888',
  // compound neutrals
  'warm gray':    '#9E9990',
  'cool gray':    '#929699',
  'warm grey':    '#9E9990',
  'cool grey':    '#929699',
  'light gray':   '#CECECE',
  'light grey':   '#CECECE',
  'warm beige':   '#DDD0B8',
  'cool beige':   '#D5CEC5',
  'warm taupe':   '#BFB0A2',
  'cool taupe':   '#B0ADB0',
  // browns
  brown:          '#7B4F2E',
  rust:           '#B44010', // warm red-orange
  terracotta:     '#C06448', // muted warm red-clay
  // whites / blacks
  white:          '#F5F5F5',
  black:          '#1C1C1C',
  // blues
  navy:           '#1B2848', // very dark blue
  cobalt:         '#0047AB', // vivid pure blue
  'royal blue':   '#4169E1',
  'dark blue':    '#00008B',
  'light blue':   '#ADD8E6',
  'pale blue':    '#C5DCE8',
  blue:           '#2255AA',
  indigo:         '#3D3B8E',
  teal:           '#217A6C', // blue-green
  // reds / pinks / purples
  red:            '#C82828',
  burgundy:       '#7D1020', // deep red-wine
  wine:           '#6E2635',
  maroon:         '#7A0030', // dark muted red
  coral:          '#E8604A',
  pink:           '#F48FB1',
  purple:         '#7B1FA2',
  violet:         '#5E35B1',
  // greens
  green:          '#2D7D32',
  'forest green': '#1A5C22',
  // yellows / oranges
  yellow:         '#F5C200',
  mustard:        '#C89A10', // deep saturated yellow-brown
  orange:         '#E65100',
};

/**
 * Disambiguation labels for ambiguous neutrals that models frequently drift from.
 * Pairs with ANCHOR_COLOR_HEX to give both a hex target and an exclusion hint.
 */
const NEUTRAL_COLOR_CLARIFICATIONS: Record<string, string> = {
  // fine-grain neutrals — do NOT collapse these to "beige", "brown", or "tan"
  taupe:          'taupe — medium neutral gray-brown (NOT beige, NOT brown, NOT stone, NOT gray)',
  greige:         'greige — gray-beige blend, slightly warm (NOT beige, NOT gray, NOT tan)',
  mushroom:       'mushroom — warm muted gray-brown, earthy (NOT brown, NOT beige, NOT gray)',
  oatmeal:        'oatmeal — warm pale beige-cream, very light (NOT cream, NOT tan, NOT beige)',
  putty:          'putty — warm medium neutral, slightly yellow-gray (NOT tan, NOT beige, NOT khaki)',
  dove:           'dove — cool pale gray, very light (NOT white, NOT silver, NOT gray)',
  ash:            'ash — cool medium gray, slightly desaturated (NOT charcoal, NOT gray, NOT silver)',
  pebble:         'pebble — medium warm gray with slight brown cast (NOT gray, NOT brown, NOT taupe)',
  chalk:          'chalk — very pale warm off-white (NOT white, NOT ivory, NOT cream)',
  bone:           'bone — very pale warm white with yellowed cast (NOT ivory, NOT cream, NOT white)',
  linen:          'linen — warm pale ecru-beige (NOT beige, NOT ecru, NOT cream)',
  flax:           'flax — warm light golden-beige (NOT tan, NOT beige, NOT camel)',
  driftwood:      'driftwood — muted warm gray-brown, desaturated (NOT brown, NOT taupe, NOT gray)',
  // existing clarifications
  stone:          'stone — cool pale gray-beige (NOT tan, NOT camel, NOT brown, NOT warm)',
  sand:           'sand — warm pale off-white beige (NOT tan, NOT brown, NOT yellow)',
  ecru:           'ecru — warm pale off-white (NOT cream, NOT tan, NOT beige)',
  slate:          'slate — cool blue-gray (NOT gray, NOT blue, NOT charcoal)',
  camel:          'camel — warm medium tan-brown (NOT brown, NOT tan, NOT mustard)',
  tan:            'tan — light warm neutral (NOT camel, NOT beige, NOT brown)',
  beige:          'beige — pale warm neutral (NOT tan, NOT cream, NOT off-white)',
  ivory:          'ivory — very pale warm white (NOT white, NOT cream, NOT beige)',
  cream:          'cream — pale warm off-white (NOT ivory, NOT white, NOT beige)',
  'off-white':    'off-white — near-white with subtle warmth (NOT ivory, NOT cream)',
  khaki:          'khaki — yellow-green muted military (NOT tan, NOT beige, NOT olive)',
  olive:          'olive — dull yellow-green (NOT khaki, NOT green, NOT brown)',
  charcoal:       'charcoal — very dark gray (NOT black, NOT navy, NOT gray)',
  rust:           'rust — warm red-orange (NOT terracotta, NOT brown, NOT orange)',
  terracotta:     'terracotta — muted warm red-clay (NOT rust, NOT brown, NOT orange)',
  mustard:        'mustard — deep saturated yellow-brown (NOT camel, NOT tan, NOT yellow)',
  burgundy:       'burgundy — deep red-wine (NOT maroon, NOT red, NOT brown)',
  maroon:         'maroon — dark muted red (NOT burgundy, NOT red, NOT brown)',
  teal:           'teal — blue-green (NOT green, NOT blue, NOT cyan)',
  cobalt:         'cobalt — vivid pure blue (NOT navy, NOT royal blue)',
  navy:           'navy — very dark blue (NOT black, NOT dark blue, NOT cobalt)',
};

function extractAnchorColor(description: string): string | null {
  const d = description.toLowerCase();
  for (const color of ANCHOR_COLOR_WORDS) {
    if (d.includes(color)) return color;
  }
  return null;
}

/**
 * Primary path: build the color lock from vision-extracted metadata.
 * The hex was sampled directly from the uploaded anchor image — it is the
 * ground truth, not a dictionary approximation.
 */
function buildAnchorColorBlockFromMetadata(anchorName: string, meta: AnchorColorMetadata): string {
  const lines: string[] = [
    `ANCHOR COLOR LOCK (non-negotiable — apply before rendering anything else):`,
    `The anchor item — ${anchorName} — must match the uploaded reference photo with exact color fidelity.`,
  ];

  if (meta.isMultiColor && meta.secondaryColors.length > 0) {
    lines.push(
      `This is a multi-color item. Preserve ALL color zones exactly:`,
      `  • Dominant color: ${meta.dominantColorName} — hex ${meta.dominantColorHex}`,
      ...meta.secondaryColors.map(
        (c) => `  • ${c.placement}: ${c.name} — hex ${c.hex}`
      )
    );
    if (meta.colorPattern) {
      lines.push(`  Color layout: ${meta.colorPattern}.`);
    }
  } else {
    lines.push(
      `Exact color: ${meta.dominantColorName} — hex ${meta.dominantColorHex}`,
      `Lightness: ${meta.lightnessTone}. Temperature: ${meta.temperatureTone}.`,
      `The hex ${meta.dominantColorHex} is sampled directly from the uploaded photo. Use it as the ground-truth color.`
    );
  }

  lines.push(
    `Do not shift this color warmer, cooler, darker, or browner for any reason.`,
    `Do not let the tier (Business / Smart Casual / Casual) change this color — it must appear identically across all tiers.`,
    `If uncertain: interpret this color as ${meta.lightnessTone} and ${meta.temperatureTone} — not darker, not warmer, not browner than the hex indicates.`
  );

  return lines.join('\n');
}

/**
 * Fallback path: build the color lock from a color word extracted from text description.
 * Used when no image was uploaded or vision analysis failed.
 */
function buildAnchorColorBlockFromWord(anchorName: string, rawColor: string): string {
  const hex = ANCHOR_COLOR_HEX[rawColor];
  const clarification = NEUTRAL_COLOR_CLARIFICATIONS[rawColor];

  const colorTarget = hex
    ? `${rawColor} — hex ${hex}${clarification ? ` (${clarification.split(' — ')[1] ?? ''})` : ''}`
    : clarification ?? rawColor;

  return [
    `ANCHOR COLOR LOCK (non-negotiable — apply before rendering anything else):`,
    `The anchor item — ${anchorName} — MUST be rendered in exactly: ${colorTarget}.`,
    hex ? `The hex code ${hex} is the exact target. Sample it mentally and use it precisely.` : '',
    `This color is fixed across all tiers. Do not shift it warmer, cooler, darker, brighter, or more muted for any reason.`,
    `Do not reinterpret it as a visually similar neutral. Do not let tier style, lighting, or surrounding garments affect this color.`,
    `If you are uncertain: match the hex literally rather than approximating from the color name.`,
  ].filter(Boolean).join('\n');
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
  'Push the rendering toward a high-end fashion concept sketch — the kind printed in a luxury menswear style board or editorial lookbook. ' +
  'Make the outfit feel more stylish, directional, and modern, with sharper taste, stronger styling, and more confident silhouette choices while staying completely true to the provided garments. ' +
  'Increase color fidelity: the anchor piece and every described clothing item must match the real garment color as accurately as possible, prioritizing the exact hue, depth, temperature, and saturation of the source item rather than drifting toward generic beige, tan, or neutralized approximations. ' +
  'Do not reinterpret the anchor item\'s color; preserve it faithfully. ' +
  'Increase richness and vibrancy while keeping the palette refined and believable, so the image feels alive and confident. ' +
  'Add more garment detail and material realism: show seam lines, ribbing, stitch lines, plackets, pocket construction, zipper hardware, fabric grain, creases, drape, cuff structure, collar shape, sole detail, and small accessory details with precision. ' +
  'Use layered ink and tonal depth, nuanced shadowing, and tactile surface detail so the garments feel luxurious and dimensional. ' +
  'Avoid color drift, generic neutralization, flat fills, or loss of garment-specific detail.';

const QUALITY_ADDENDUM_2 =
  'HEADLESS VERIFICATION (check first): Does the figure have a head, face, hair, or any facial feature? If yes, that is a critical failure — the subject must be a headless mannequin cut at the collar/neckline. Above the neckline must be empty paper only. ' +
  'Increase the level of garment and accessory detail. ' +
  'Show more construction and material information: seam placement, topstitching, rib knit texture, zipper teeth and puller, pocket welts, plackets, collar structure, cuff shape, waistband finish, belt hardware, shoe panels, laces, sole edges, watch case detail, and subtle fabric grain. ' +
  'Make the colors richer and more vibrant while staying refined and believable, with stronger tonal contrast and clearer color separation between garments so the outfit feels fashion-forward, polished, and visually alive. ' +
  'Preserve accurate color fidelity to the source garments, especially the anchor piece, matching the true hue, saturation, undertone, and value rather than drifting toward generic tan or beige. ' +
  'COMPOSITION VERIFICATION (check before finalizing): Is the collar/neckline visible with empty paper above it? Are both shoe soles fully rendered and clearly visible with empty paper below them? Is the figure centered horizontally with empty paper on both sides? ' +
  'CRITICAL FRAMING CHECK — if shoe soles are not clearly visible with empty canvas below them, the figure is too large or positioned too low: scale the figure down and re-center vertically. Invisible feet or cropped ankles are a hard composition failure, not a stylistic choice. ' +
  'The correct result looks like a zoomed-out editorial lookbook photo: complete outfit floating in generous whitespace, not a cropped close-up filling the frame edge to edge.';

// ── Outfit tier sketch prompt ─────────────────────────────────────────────────

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  anchorColorMetadata?: AnchorColorMetadata | null;
  subjectBrief?: string | null;
  recommendation: TierRecommendationDto;
}) {
  const anchor = input.anchorItemDescription.trim();
  const anchorName = shortenPieceName(anchor);

  const allKeyPieces = input.recommendation.keyPieces.slice(0, 4);
  const outerwearPieces = allKeyPieces.filter(isOuterwear);
  const remainingKeyPieces = allKeyPieces.filter((p) => !isOuterwear(p));
  const hasOuterwear = outerwearPieces.length > 0;
  const anchorMidLayer = anchorIsMidLayer(anchor);

  // Color lock block — vision metadata path is primary; text extraction is fallback.
  // Vision metadata contains a hex sampled directly from the uploaded image, which is
  // far more accurate than any static dictionary lookup.
  let anchorColorBlock: string | null = null;
  let anchorSuffix = '';

  if (input.anchorColorMetadata) {
    anchorColorBlock = buildAnchorColorBlockFromMetadata(anchorName, input.anchorColorMetadata);
    // Suffix for the anchor bullet line in the outfit list
    const meta = input.anchorColorMetadata;
    if (meta.isMultiColor && meta.colorPattern) {
      anchorSuffix = ` (color: ${meta.dominantColorName} ${meta.dominantColorHex}; ${meta.colorPattern})`;
    } else {
      anchorSuffix = ` (color: ${meta.dominantColorName} ${meta.dominantColorHex})`;
    }
  } else {
    // Fallback: extract color word from text description
    const anchorColor = extractAnchorColor(anchor);
    const anchorHex = anchorColor ? (ANCHOR_COLOR_HEX[anchorColor] ?? null) : null;
    const anchorPattern = patternHint(anchor);
    const anchorDetail = [
      anchorColor ? `color: ${anchorColor}${anchorHex ? ` ${anchorHex}` : ''}` : null,
      anchorPattern ? `pattern: ${anchorPattern}` : null,
    ].filter(Boolean).join(', ');
    anchorSuffix = anchorDetail ? ` (${anchorDetail})` : '';
    anchorColorBlock = anchorColor ? buildAnchorColorBlockFromWord(anchorName, anchorColor) : null;
  }

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

  const outfitSection = `Outfit:\n${outfitLines.join('\n')}`;
  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    input.subjectBrief ?? null,
    STYLE_PREAMBLE,
    anchorColorBlock ?? null,
    outfitSection,
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
  ].filter(Boolean);

  return parts.join('\n\n');
}
