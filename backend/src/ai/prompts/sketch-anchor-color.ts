import type { AnchorColorMetadata } from '../../modules/outfits/anchor-description.service.js';

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
export const ANCHOR_COLOR_HEX: Record<string, string> = {
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

export function extractAnchorColor(description: string): string | null {
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
export function buildAnchorColorBlockFromMetadata(anchorName: string, meta: AnchorColorMetadata): string {
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
export function buildAnchorColorBlockFromWord(anchorName: string, rawColor: string): string {
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

export function patternHint(description: string): string | null {
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
