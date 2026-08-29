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
    input.garmentCategories.length ? `Garments mentioned: ${input.garmentCategories.join(', ')}` : null,
    input.silhouettes.length ? `Silhouette: ${input.silhouettes.join(', ')}` : null,
    input.colours.length ? `Colours: ${input.colours.join(', ')}` : null,
    input.materialsOrTextures.length ? `Materials/textures: ${input.materialsOrTextures.join(', ')}` : null,
    input.footwear.length ? `Footwear mentioned: ${input.footwear.join(', ')}` : null,
    input.accessories.length ? `Accessories mentioned: ${input.accessories.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const trendSection = [
    `Fashion trend: "${input.name}" (${input.formality} formality)`,
    `Trend summary: ${input.summary}`,
    details
      ? `Supporting attribute lists — describe the hero item identified below, NOT a menu of alternative items:\n${details}`
      : null,
  ].filter(Boolean).join('\n\n');

  const parts = [
    CLOSET_ITEM_STYLE_PREAMBLE,
    trendSection,
    'This sketch illustrates a SEASONAL FASHION TREND CONCEPT, not a specific real garment someone owns. The trend NAME and SUMMARY above state what this trend is actually about — identify the ONE hero item they describe (e.g. a trend about tailoring, a jacket, trousers, or a suit means that garment is the hero item; a trend explicitly about a shoe or an accessory means that is the hero item) and render ONLY that one item as an isolated hero product illustration. The garments/silhouette/colour/material/footwear/accessories lists above exist ONLY to add descriptive detail (colour, material, silhouette) to that ONE hero item — they are NOT alternative items to choose from, and a footwear or accessory mention in those lists must NEVER override what the trend name/summary is actually about. Do NOT render a full outfit, a body, or a mannequin, and do NOT depict multiple garments worn together. Stay strictly within the stated formality band.',
    CLOSET_ITEM_QUALITY_ADDENDUM,
    CLOSET_ITEM_COMPOSITION_RULES,
  ];

  return parts.join('\n\n');
}
