// ── Closet item PAIR sketch prompt ──────────────────────────────────────────
// For a user-created "set" closet item (e.g. a blazer + trousers paired into
// a suit) — two existing closet items combined into one NEW closet item.
// Visually this belongs with the single closet-item illustrations
// (closet-item-sketch.prompts.ts): an isolated product sketch, no figure, no
// mannequin — NOT the worn-outfit style used by closet-outfit-sketch.prompts.ts,
// since this renders as one entry in "My Closet" alongside individual items,
// not a recommended look shown on a body.

import { CLOSET_ITEM_QUALITY_ADDENDUM } from './closet-item-sketch.prompts.js';

export type ClosetItemPairPiece = {
  title: string;
  category: string;
  primaryColor?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  pattern?: string | null;
  silhouette?: string | null;
};

const PAIR_STYLE_PREAMBLE =
  'Create a consistent editorial menswear fashion illustration in the exact same visual language across generations. ' +
  'Use an atmospheric hand-rendered watercolor sketch treatment throughout. ' +
  'The background must be a warm off-white watercolor paper field with visible paper grain, soft beige-gray wash, uneven transparency, subtle pigment blooms, faint edge staining, cloudy tonal variation, and loose brush residue around the subject — never a flat white or clean digital background. ' +
  'The linework should feel organic and slightly imperfect: scratchy graphite-and-ink contours, light hand jitter, and softly broken outlines rather than crisp polished edges. ' +
  'Apply transparent layered watercolor fills with rich, accurate garment color and gentle pooling and bleeding of pigment at folds, seams, edges, and shadow areas. ' +
  'Fabric textures, weave patterns, stitching, and material sheen should be rendered with high fidelity. ' +
  'The overall image must be tactile, painterly, and editorial — like a luxury stylist\'s sketchbook page. ' +
  'Avoid vector cleanliness, sterile negative space, hard digital edges, glossy rendering, flat color blocking, cartoon polish, or overly neat app-illustration treatment. ' +
  'The subject is a matched two-piece SET, not a single item and not a full worn outfit — there is NO figure, NO mannequin, NO body, NO face, NO hands anywhere in the image. ' +
  'Render both pieces together in one cohesive product composition so it reads as ONE clothing set photographed together for a product page, not two separate isolated product shots stitched into one frame. ' +
  'COMPOSITION — HARD CONSTRAINT: arrange the two pieces so BOTH are entirely visible with clear separation between them — e.g. side by side, or the lower piece laid flat below the upper piece with visible space between them. ' +
  'Do NOT stack, layer, or place one piece directly behind or underneath the other in a way that hides, crops, or obscures any part of either piece — every silhouette edge of both pieces must be fully readable, with no overlap between the two garments. ' +
  'If in doubt, favor more separation between the two pieces over a tighter "worn together" arrangement.' +
  'Keep the same luxury menswear watercolor-paper aesthetic as the other closet-item and outfit illustrations so this image belongs to the exact same visual system.';

function describeItem(item: ClosetItemPairPiece): string {
  const color = item.primaryColor || item.colorFamily;
  const details = [color, item.pattern, item.material, item.silhouette].filter(Boolean).join(', ');
  return details ? `${item.title} (${details})` : item.title;
}

export function buildClosetItemPairSketchPrompt(input: {
  setTitle: string;
  items: ClosetItemPairPiece[];
  /** True when the two source items' own existing photos/sketches are attached as reference images to this request. */
  hasReferenceImages?: boolean;
}): string {
  const itemLines = input.items
    .map((item, index) => `- piece ${index + 1} (${item.category}): ${describeItem(item)}`)
    .join('\n');

  const referenceRule = input.hasReferenceImages
    ? 'REFERENCE IMAGES — GROUND TRUTH: the attached images show the two ACTUAL pieces this set is made from, in order (image 1 = piece 1, image 2 = piece 2, matching the list below). ' +
      'Render each piece true to its reference image — exact color, pattern, silhouette, construction detail, and material — reinterpreted only in the watercolor-sketch treatment, never redesigned or genericized. ' +
      'The text descriptions below are supplementary context, not a substitute for what the reference images show.'
    : null;

  const exclusivityRule =
    'EXACT TWO-PIECE SET — HARD CONSTRAINT: render ONLY the two pieces listed below, combined. ' +
    'Do not add a third garment, layer, or accessory of any kind — no shirt, undershirt, sweater, tie, belt, shoes, bag, or jewelry unless it is explicitly one of the two pieces listed.';

  const parts = [
    PAIR_STYLE_PREAMBLE,
    referenceRule,
    `Set "${input.setTitle}":\n${itemLines}`,
    exclusivityRule,
    CLOSET_ITEM_QUALITY_ADDENDUM,
    'Render this as a collectible editorial product sketch of a matched two-piece set in the same watercolor-paper style system as the other closet illustrations — both pieces isolated together, fully visible, color-accurate, and materially specific. No body, no mannequin, no worn presentation.',
  ].filter(Boolean);

  return parts.join('\n\n');
}
