import {
  CLOSET_ITEM_COMPOSITION_RULES,
  CLOSET_ITEM_QUALITY_ADDENDUM,
  CLOSET_ITEM_STYLE_PREAMBLE,
} from './closet-item-sketch.prompts.js';

// Sketch prompt for one entry in the "Fashion Trend Report". A trend report
// row is about ONE trend-defining piece (a shoe, a jacket, a knit, an
// accessory), not a full head-to-toe outfit — so this reuses the single-item
// closet product-shot visual system (isolated, no body/mannequin, no full
// outfit) rather than the full-figure outfit sketch system. The model is
// told to pick the single most trend-defining item out of the trend's
// garment/silhouette/colour/material guidance and render only that.

export type TrendSketchInput = {
  name: string;
  summary: string;
  formality: 'business' | 'smart-casual' | 'casual';
  garmentCategories: string[];
  silhouettes: string[];
  colours: string[];
  materialsOrTextures: string[];
  footwear: string[];
  accessories: string[];
};

export function buildTrendSketchPrompt(input: TrendSketchInput): string {
  const details = [
    input.garmentCategories.length ? `Garments: ${input.garmentCategories.join(', ')}` : null,
    input.silhouettes.length ? `Silhouette: ${input.silhouettes.join(', ')}` : null,
    input.colours.length ? `Colours: ${input.colours.join(', ')}` : null,
    input.materialsOrTextures.length ? `Materials/textures: ${input.materialsOrTextures.join(', ')}` : null,
    input.footwear.length ? `Footwear: ${input.footwear.join(', ')}` : null,
    input.accessories.length ? `Accessories: ${input.accessories.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const trendSection = [
    `Fashion trend: "${input.name}" (${input.formality} formality)`,
    input.summary,
    details,
  ].filter(Boolean).join('\n');

  const parts = [
    CLOSET_ITEM_STYLE_PREAMBLE,
    trendSection,
    'This sketch illustrates a SEASONAL FASHION TREND CONCEPT, not a specific real garment someone owns. Identify the SINGLE most trend-defining item out of the guidance above — prefer a listed footwear or accessory item if one is named, otherwise the primary garment category — and render ONLY that one item as an isolated hero product illustration. Every other detail (silhouette, colour, material, any other listed category) describes that ONE hero item, not separate pieces — do NOT render a full outfit, a body, or a mannequin, and do NOT depict multiple garments worn together. Stay strictly within the stated formality band.',
    CLOSET_ITEM_QUALITY_ADDENDUM,
    CLOSET_ITEM_COMPOSITION_RULES,
  ];

  return parts.join('\n\n');
}
