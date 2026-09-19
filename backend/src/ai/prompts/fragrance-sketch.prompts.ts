import { z } from 'zod';

import type { JsonSchemaConfig } from '../openai-request-builder.js';

// ── Fragrance bottle sketch ───────────────────────────────────────────────────
//
// A deliberately SEPARATE visual path from garment sketching
// (closet-item-sketch.prompts.ts) — that style system explicitly assumes
// fabric, drape, and a menswear-editorial garment illustration, none of which
// applies to a bottle. This mirrors its STRUCTURE (a vision-description step
// feeding a prompt builder, same warm watercolor-paper background for visual
// continuity with the rest of Vesture's closet) but with bottle-appropriate
// composition rules and no fabric/body/mannequin language anywhere.

// ── Bottle vision description (optional — only when an image is available) ───

export const fragranceBottleDescriptionSchema = z.object({
  bottleShape: z.string(),
  capType: z.string(),
  capColor: z.string(),
  bottleColor: z.string(),
  liquidColor: z.string().nullable().optional(),
  labelColor: z.string().nullable().optional(),
  // Only legible label text — never a guess at brand/name; identification
  // itself is handled separately by fragrance-classify/fragrance-profile.
  visibleLabelText: z.string().nullable().optional(),
  distinctiveFeatures: z.string().nullable().optional(),
});

export type FragranceBottleDescription = z.infer<typeof fragranceBottleDescriptionSchema>;

const BOTTLE_DESCRIPTION_INSTRUCTIONS =
  'Describe the physical fragrance bottle shown in this photo — shape, cap, colors, and any distinctive design details — precisely enough that an illustrator could redraw it without seeing the photo again. ' +
  'Only report label text you can actually read; leave visibleLabelText null if the label is illegible or angled away. Do not guess a brand or fragrance name here. ' +
  'Return only structured JSON matching the schema.';

const BOTTLE_DESCRIPTION_USER_TEXT =
  'Describe this fragrance bottle\'s physical appearance: shape, cap type and color, bottle glass/body color, visible liquid color if any, label color, any legible label text, and any distinctive design features (unusual silhouette, faceting, embossing, ornamentation).';

export function buildFragranceBottleDescriptionJsonSchema(): JsonSchemaConfig {
  return {
    name: 'fragrance_bottle_description',
    description: 'Physical description of a fragrance bottle for sketch generation',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bottleShape: { type: 'string', description: 'e.g. "tall rectangular flacon", "tapered cylindrical", "flask-style"' },
        capType: { type: 'string', description: 'e.g. "flat square cap", "rounded dome cap", "spray atomizer nozzle"' },
        capColor: { type: 'string' },
        bottleColor: { type: 'string', description: 'Glass/body color, e.g. "clear", "smoked amber", "frosted white"' },
        liquidColor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        labelColor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        visibleLabelText: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Only text actually legible in the photo — null if illegible' },
        distinctiveFeatures: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['bottleShape', 'capType', 'capColor', 'bottleColor', 'liquidColor', 'labelColor', 'visibleLabelText', 'distinctiveFeatures'],
    },
  };
}

export const BOTTLE_DESCRIPTION_PROMPT = {
  instructions: BOTTLE_DESCRIPTION_INSTRUCTIONS,
  userText: BOTTLE_DESCRIPTION_USER_TEXT,
};

// ── Sketch prompt builder ─────────────────────────────────────────────────────

const FRAGRANCE_SKETCH_STYLE_PREAMBLE =
  'Create a clean, polished product illustration of a single fragrance bottle, in the same warm off-white watercolor-paper world as the rest of this app\'s closet sketches, but rendered as a refined PRODUCT illustration, not a garment illustration. ' +
  'The background is a warm off-white paper field with soft, understated texture — much quieter and cleaner than a busy watercolor wash; the bottle itself is the entire focus, with no clutter, no props, no surface reflections beyond a soft simple shadow beneath the bottle. ' +
  'This is a bottle, not a body: there must be no mannequin, no figure, no hand, no fabric, no clothing, and no garment-style drape anywhere in the image. ' +
  'Render the bottle with a clean, confident outline and light, precise shading — closer to a refined perfume-house product sketch than a loose painterly wash. Preserve the bottle\'s real proportions, cap shape, and any distinctive silhouette details faithfully.';

const FRAGRANCE_SKETCH_COMPOSITION_RULES =
  'Center the bottle upright, fully visible with a small margin on all sides — never cropped, never at an extreme angle. ' +
  'Show the bottle from a clean three-quarter or front-facing product-photography angle that reveals both the cap and the label face. ' +
  'Keep proportions between the cap, neck, and body accurate to the description provided. ' +
  'If label text was legible in the source photo, suggest its placement and rough lettering weight without necessarily rendering every character legibly — the goal is recognizability of the actual bottle, not a literal text reproduction. ' +
  'The final image must read instantly as "a fragrance bottle," suitable as a small Closet thumbnail as well as a larger detail view.';

export type FragranceSketchInput = {
  brand: string;
  name: string;
  concentration?: string | null;
  description?: FragranceBottleDescription | null;
};

export function buildFragranceSketchPrompt(input: FragranceSketchInput): string {
  const identityLine = `Fragrance: ${input.brand} ${input.name}${input.concentration ? ` (${input.concentration})` : ''}.`;

  const detailLines = input.description
    ? [
        `Bottle shape: ${input.description.bottleShape}.`,
        `Cap: ${input.description.capType}, ${input.description.capColor}.`,
        `Bottle color: ${input.description.bottleColor}.`,
        input.description.liquidColor ? `Liquid color: ${input.description.liquidColor}.` : null,
        input.description.labelColor ? `Label color: ${input.description.labelColor}.` : null,
        input.description.visibleLabelText ? `Visible label text: "${input.description.visibleLabelText}".` : null,
        input.description.distinctiveFeatures ? `Distinctive features: ${input.description.distinctiveFeatures}.` : null,
      ].filter((line): line is string => line !== null).join(' ')
    : // No source photo (manual entry) — describe a plausible, tasteful bottle
      // for this identity rather than fabricating specific label/cap details
      // as if observed. Section 6/7: a sketch is still attempted from identity
      // alone when reasonable.
      'No reference photo was available — render a tasteful, generic fragrance bottle silhouette appropriate to this brand and concentration\'s typical presentation, without claiming to depict the exact real packaging.';

  return [FRAGRANCE_SKETCH_STYLE_PREAMBLE, identityLine, detailLines, FRAGRANCE_SKETCH_COMPOSITION_RULES].join(' ');
}
