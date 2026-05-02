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
  // Shared optional fields
  material?: string | null;
  silhouette?: string | null;
  details?: string | null;
  orientation?: string | null;
  stylingNotes?: string | null;
  // Enhanced garment fields
  constructionDetails?: string | null;
  standoutFeatures?: string | null;
  // Footwear-specific fields
  colorDetails?: string | null;
  secondaryMaterials?: string | null;
  toeShape?: string | null;
  vampConstruction?: string | null;
  fasteningSystem?: string | null;
  soleProfile?: string | null;
  heelType?: string | null;
  upperPaneling?: string | null;
  stitchingDetails?: string | null;
  hardwareDetails?: string | null;
  distinctiveFeatures?: string | null;
  brandLanguage?: string | null;
  // Product fidelity — hard constraints for the image model
  mustPreserve?: string[];
};

/**
 * Builds the PRODUCT FIDELITY CONSTRAINTS block.
 * This is injected immediately before the item description so the image model
 * reads the must-preserve list before it forms any visual priors.
 */
function buildProductFidelityBlock(input: ClosetItemSketchInput): string | null {
  const features = input.mustPreserve?.filter(Boolean) ?? [];
  if (!features.length) return null;

  const isFootwear = input.category === 'footwear';

  const lines: string[] = [
    '⚠ PRODUCT FIDELITY CONSTRAINTS — NON-NEGOTIABLE:',
    'This is a specific product, not a generic category illustration.',
    'The following features MUST be preserved exactly in the rendered sketch.',
    'Failure to render these features accurately is a critical prompt failure.',
    '',
    'MUST PRESERVE:',
    ...features.map((f) => `  ✓ ${f}`),
    '',
    'DO NOT:',
  ];

  if (isFootwear) {
    lines.push(
      '  ✗ Substitute a generic sneaker, boot, or loafer silhouette',
      '  ✗ Replace the sole profile with a generic rubber outsole',
      '  ✗ Invent laces if the shoe is a slip-on; invent elastic if it is lace-up',
      '  ✗ Round or sharpen the toe shape beyond what is described',
      '  ✗ Collapse distinctive vamp construction into a plain unmarked vamp',
      '  ✗ Simplify luxury/technical construction into a generic canvas or skate shoe',
      '  ✗ Remove or generalize stitching, paneling, or hardware details listed above',
    );
  } else {
    lines.push(
      '  ✗ Substitute a generic version of this garment category',
      '  ✗ Invent pockets, closures, or collar structures not described',
      '  ✗ Simplify distinctive construction details into generic stitching',
      '  ✗ Remove standout design features listed above',
    );
  }

  lines.push(
    '',
    'The sketch must read as a faithful product rendering of THIS specific item, not a generic version of its category.',
    'Product accuracy takes priority over illustrative simplification.',
  );

  return lines.join('\n');
}

export function buildClosetItemSketchPrompt(input: ClosetItemSketchInput): string {
  const isFootwear = input.category === 'footwear';
  const fidelityBlock = buildProductFidelityBlock(input);

  // Build item description — footwear gets a richer structured block
  let itemLines: string;

  if (isFootwear) {
    itemLines = [
      `- category: ${input.category}`,
      `- type: ${input.type}`,
      `- color: ${input.color}`,
      input.colorDetails   ? `- color details: ${input.colorDetails}` : null,
      input.material       ? `- primary material: ${input.material}` : null,
      input.secondaryMaterials ? `- secondary materials: ${input.secondaryMaterials}` : null,
      input.silhouette     ? `- silhouette profile: ${input.silhouette}` : null,
      input.toeShape       ? `- toe shape: ${input.toeShape}` : null,
      input.vampConstruction ? `- vamp construction: ${input.vampConstruction}` : null,
      input.fasteningSystem  ? `- fastening system: ${input.fasteningSystem}` : null,
      input.soleProfile    ? `- sole profile: ${input.soleProfile}` : null,
      input.heelType       ? `- heel type: ${input.heelType}` : null,
      input.upperPaneling  ? `- upper paneling: ${input.upperPaneling}` : null,
      input.stitchingDetails ? `- stitching: ${input.stitchingDetails}` : null,
      input.hardwareDetails  ? `- hardware: ${input.hardwareDetails}` : null,
      input.distinctiveFeatures ? `- distinctive features: ${input.distinctiveFeatures}` : null,
      input.brandLanguage  ? `- brand language: ${input.brandLanguage}` : null,
      input.stylingNotes   ? `- styling notes: ${input.stylingNotes}` : null,
    ].filter(Boolean).join('\n');
  } else {
    itemLines = [
      `- category: ${input.category}`,
      `- type: ${input.type}`,
      `- color: ${input.color}`,
      input.material           ? `- material: ${input.material}` : null,
      input.silhouette         ? `- silhouette: ${input.silhouette}` : null,
      input.details            ? `- details: ${input.details}` : null,
      input.constructionDetails ? `- construction: ${input.constructionDetails}` : null,
      input.standoutFeatures   ? `- standout features: ${input.standoutFeatures}` : null,
      input.orientation        ? `- orientation: ${input.orientation}` : null,
      input.stylingNotes       ? `- styling notes: ${input.stylingNotes}` : null,
    ].filter(Boolean).join('\n');
  }

  const parts = [
    CLOSET_ITEM_STYLE_PREAMBLE,
    fidelityBlock,
    `Item:\n${itemLines}`,
    CLOSET_ITEM_QUALITY_ADDENDUM,
    CLOSET_ITEM_COMPOSITION_RULES,
  ].filter(Boolean);

  return parts.join('\n\n');
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
