import {
  HEADLESS_GUARD,
  QUALITY_ADDENDUM,
  QUALITY_ADDENDUM_2,
  STYLE_GUARD,
  STYLE_PREAMBLE,
} from './sketch-style-preamble.js';

// Sketch prompt for one entry in the "Fashion Trend Report". Unlike outfit/
// closet sketches (a specific set of real or invented garments), this
// illustrates an abstract seasonal TREND CONCEPT — the model has to compose
// a single representative outfit from the trend's own garment/silhouette/
// colour/material guidance rather than a fixed item list.

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
    HEADLESS_GUARD,
    STYLE_GUARD,
    STYLE_PREAMBLE,
    trendSection,
    'This sketch illustrates a SEASONAL FASHION TREND CONCEPT, not a specific real garment someone owns — compose ONE clear, representative outfit that demonstrates this trend in action, built from the garment/silhouette/colour/material guidance above. Stay strictly within the stated formality band.',
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
  ];

  return parts.join('\n\n');
}
