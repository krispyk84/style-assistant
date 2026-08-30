import {
  CLOSET_ITEM_QUALITY_ADDENDUM,
  CLOSET_ITEM_STYLE_PREAMBLE,
} from './closet-item-sketch.prompts.js';

// Sketch prompt for one entry in the seasonal colour palette — a single
// fabric swatch card, not a garment or outfit. Reuses the closet-item
// watercolor visual system for consistency with the rest of the sketch
// library, with its own composition rules (a swatch has no category-specific
// silhouette to worry about, unlike a garment or accessory).

export type ColorSwatchSketchInput = {
  name: string;
  hex: string;
  description: string;
};

export function buildColorSwatchSketchPrompt(input: ColorSwatchSketchInput): string {
  const colorSection = [
    `Colour: "${input.name}" (hex ${input.hex})`,
    input.description,
  ].join('\n');

  const compositionRules =
    'The subject is a single fabric swatch card, not a garment, not an outfit, not an accessory, not a person. ' +
    'Render one physical textile swatch with visible woven fabric texture, subtle threading, and natural light falloff across the surface so it reads as a real physical material sample, not a flat digital colour chip. ' +
    'The swatch should feel tactile and premium, like a fabric card from a tailor\'s or designer\'s swatch book. ' +
    'EDGE STYLE (must match exactly, every time): all four edges of the swatch are cut with pinking shears — a continuous zigzag of small sharp triangular notches all the way around the border, like a tailor\'s cloth sample. Never render smooth edges, rounded corners, straight-cut edges, or a soft torn/deckle edge — the pinked zigzag is the only acceptable edge treatment. ' +
    'SHAPE AND SIZE (must match exactly, every time): the swatch is a portrait-oriented rectangle, taller than it is wide, at roughly a 4:5 width-to-height ratio. It fills a consistent, generous portion of the frame — about 70% of the frame\'s width and 80% of its height — with an even margin of plain background paper visible on all sides. Every colour in this series must render at this same shape, size, and framing, differing only in the colour and texture of the cloth itself. ' +
    'Centre the swatch — it must be fully visible and never cropped or touching the frame edge. ' +
    'No text, no labels, no hex codes, no logos rendered in the image. No garments, no accessories, no body, no mannequin, no additional objects — the fabric swatch is the ONLY subject.';

  const parts = [
    CLOSET_ITEM_STYLE_PREAMBLE,
    colorSection,
    'This illustrates a SEASONAL COLOUR TREND, not a specific real garment. Match the described colour as precisely and faithfully as possible — this is the entire point of the image.',
    CLOSET_ITEM_QUALITY_ADDENDUM,
    compositionRules,
  ];

  return parts.join('\n\n');
}
