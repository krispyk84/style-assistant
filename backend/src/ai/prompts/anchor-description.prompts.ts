// ─────────────────────────────────────────────────────────────────────────────
// Anchor sketch description vision prompt — used to extract a structural
// description, color metadata (with sampled hex), and drift-suppression terms
// from an uploaded anchor image. Pairs with anchorSketchDescriptionSchema in
// outfits/anchor-description.schemas.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const ANCHOR_SKETCH_DESCRIPTION_JSON_SCHEMA = {
  name: 'anchor_sketch_description',
  description: 'Structural description, color metadata, and drift-suppression terms for any fashion item',
  schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'One sentence with precise colour (warm/cool qualifier) followed by structural identity features, comma-separated. ' +
          'Garments: colour + exact family name, collar type, closure mechanism, lapels present/absent, hem and cuff finish, pocket placement. ' +
          'Example: "Cool grey-taupe bomber jacket, ribbed band collar, front zip closure, no lapels, patch hip pockets, elasticated hem and cuffs." ' +
          'Footwear: colour + exact family name, toe shape (round/square/pointed), heel type, closure method (lace/buckle/zip/slip-on). ' +
          'Example: "Warm tan suede chelsea boot, round toe, stacked block heel, elasticated side gussets, slip-on." ' +
          'Bags: colour + material + exact family name, handle type, hardware colour, shape (structured/slouchy). ' +
          'Belts: colour + material + exact family name, width, buckle type, hardware colour. ' +
          'Hats: colour + exact family name, brim shape, crown shape, any band or trim. ' +
          'Eyewear: frame colour + exact frame shape, lens colour. ' +
          'Watches/jewellery: metal tone + piece type, case shape, strap material. ' +
          'Never use ambiguous single-word colours — always add warm/cool qualifier.',
      },
      antiDrift: {
        type: 'string',
        description:
          'Comma-separated terms for the sketch negative prompt — the wrong item types and structural features a fashion illustration model commonly substitutes for this item. ' +
          'Think: given a "business" or "smart casual" styling brief, what would the model wrongly draw instead? ' +
          'Include BOTH the wrong category names AND their most distinctive structural features. ' +
          'If the item is unlikely to be misidentified (e.g. a watch, sunglasses), return empty string.',
      },
      colorMetadata: {
        type: 'object',
        description:
          'Precise color data sampled directly from the image. This is the ground-truth color that will be locked in the sketch prompt. ' +
          'For neutrals like taupe, greige, stone, oatmeal, mushroom — always use compound names (e.g. "light grey-taupe", "warm greige", "pale stone-beige"). ' +
          'NEVER collapse a light taupe/greige/stone to just "beige" or "brown" or "tan".',
        properties: {
          dominantColorHex: {
            type: 'string',
            description:
              'Hex code (#RRGGBB) of the dominant fabric/material color. ' +
              'Sample the midtone area of the fabric — avoid shadows, highlights, seams, and edges. ' +
              'For a light taupe fabric, this might be #C8BAB0. For stone, around #C2B8AE. For greige, around #C4B8A6. ' +
              'Be precise — this hex is used directly by the sketch generation model.',
          },
          dominantColorName: {
            type: 'string',
            description:
              'Precise compound color name matching the hex. For neutrals, always use compound descriptors: ' +
              '"light grey-taupe", "warm greige", "pale stone-beige", "soft mushroom", "warm oatmeal", "cool dove-gray", ' +
              '"light warm sand", "pale linen", "muted khaki-beige". ' +
              'NEVER collapse to a single generic word like "beige", "tan", or "brown" for light neutrals.',
          },
          lightnessTone: {
            type: 'string',
            enum: ['very light', 'light', 'medium', 'dark', 'very dark'],
            description: 'Perceptual lightness of the dominant color.',
          },
          temperatureTone: {
            type: 'string',
            enum: ['warm', 'neutral', 'cool'],
            description: 'Color temperature. Grey-taupes lean neutral-to-cool. Warm beiges lean warm. Stone can be neutral or cool.',
          },
          isMultiColor: {
            type: 'boolean',
            description: 'True for striped, checked, color-blocked, patterned, or multi-tone items.',
          },
          secondaryColors: {
            type: 'array',
            description: 'For multi-color items: list each distinct color zone. Empty array for solid items.',
            items: {
              type: 'object',
              properties: {
                hex: { type: 'string', description: 'Hex code of this color zone.' },
                name: { type: 'string', description: 'Precise color name for this zone.' },
                placement: { type: 'string', description: 'Where this color appears, e.g. "stripes", "collar", "cuffs and hem", "upper panel".' },
              },
              required: ['hex', 'name', 'placement'],
              additionalProperties: false,
            },
          },
          colorPattern: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description:
              'For multi-color items: concise description of the color layout. ' +
              'Examples: "white body with narrow navy vertical stripes", "color-blocked — olive upper body, cream lower", ' +
              '"houndstooth — black and white repeating check". Null for solid items.',
          },
        },
        required: ['dominantColorHex', 'dominantColorName', 'lightnessTone', 'temperatureTone', 'isMultiColor', 'secondaryColors', 'colorPattern'],
        additionalProperties: false,
      },
    },
    required: ['description', 'antiDrift', 'colorMetadata'],
    additionalProperties: false,
  },
};

export const ANCHOR_SKETCH_DESCRIPTION_INSTRUCTIONS =
  'You are a fashion illustrator preparing a brief for a sketch artist and a color-locked generation system. ' +
  'Your three outputs are: a structural description, color metadata with a direct hex sample, and drift-suppression terms.\n\n' +
  'DESCRIPTION: One sentence, comma-separated. Start with precise colour (warm/cool qualifier). ' +
  'Then list structural features that make this item uniquely identifiable.\n\n' +
  'COLOR METADATA: This is critical. Look at the actual fabric/material and extract the real color.\n' +
  '- dominantColorHex: sample the midtone of the fabric (not the shadow, not the highlight) and give the closest hex code.\n' +
  '- dominantColorName: use compound names for ALL neutrals. A light grey-beige bomber is NOT "beige" — it is "light grey-taupe" or "pale greige".\n' +
  '  Acceptable neutral names: light grey-taupe, warm greige, pale stone-beige, soft mushroom, warm oatmeal, cool dove-gray, pale sand, light linen.\n' +
  '  Do NOT collapse to: beige, brown, tan, gray, stone. Always qualify with lightness (light/pale/soft) AND temperature (warm/cool/neutral).\n' +
  '- For multi-color items (stripes, checks, color-blocks): isMultiColor=true, list each color zone in secondaryColors, describe layout in colorPattern.\n\n' +
  'ANTI_DRIFT: What would a fashion illustration model draw INSTEAD of this item when given a formal/business styling prompt? ' +
  'List those wrong categories AND their distinctive structural features.';

export const ANCHOR_SKETCH_DESCRIPTION_USER_TEXT =
  'Describe this fashion item for a sketch artist. Extract the precise color with hex code from the fabric. ' +
  'Then list what a fashion illustration model would wrongly draw instead of it under business/formal styling pressure.';
