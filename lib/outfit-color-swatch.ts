/**
 * Color-name -> display hex, for the small swatch shown beside each suggested
 * item name in "The Look". Mirrors backend/src/ai/prompts/sketch-anchor-color.ts's
 * ANCHOR_COLOR_HEX (the app's existing canonical color-word -> hex mapping,
 * already used to lock sketch-generation color) — same words, same hex
 * values, so the swatch matches what the sketch itself was told to render.
 * Kept as a separate frontend copy since that file isn't shared with the
 * backend (mirrors the existing lib/closet-match-taxonomy.ts <->
 * backend/.../closet-taxonomy.ts split for the same reason).
 *
 * outfit pieces' metadata.color is a free string (backend JSON schema:
 * "Dominant color of the piece, e.g. 'Navy', 'Stone', 'Off-white'") — always
 * ONE dominant color per piece, so no multi-color representation is needed
 * here. An unrecognized or missing color name resolves to null; callers
 * should omit the swatch entirely in that case rather than guess.
 */
const OUTFIT_COLOR_HEX: Record<string, string> = {
  taupe: '#B8AFA6',
  greige: '#C4B8A6',
  mushroom: '#BFB2A6',
  oatmeal: '#D8CCBA',
  putty: '#C9BDAC',
  dove: '#D5D3CD',
  ash: '#ABABAB',
  pebble: '#9E9A94',
  chalk: '#EDE9E2',
  bone: '#E8E2D5',
  linen: '#E8DFCC',
  flax: '#D9C99A',
  driftwood: '#B0A898',
  stone: '#C4BAB0',
  sand: '#E0D0B0',
  ecru: '#EFE3CC',
  slate: '#7A8A96',
  camel: '#C19A6B',
  tan: '#D2B48C',
  beige: '#E8DCC8',
  ivory: '#F6F0E4',
  cream: '#FFFBEF',
  'off-white': '#FAF8F2',
  khaki: '#C3B08A',
  olive: '#7A7A30',
  charcoal: '#3A3A3A',
  gray: '#888888',
  grey: '#888888',
  'warm gray': '#9E9990',
  'cool gray': '#929699',
  'warm grey': '#9E9990',
  'cool grey': '#929699',
  'light gray': '#CECECE',
  'light grey': '#CECECE',
  'warm beige': '#DDD0B8',
  'cool beige': '#D5CEC5',
  'warm taupe': '#BFB0A2',
  'cool taupe': '#B0ADB0',
  brown: '#7B4F2E',
  rust: '#B44010',
  terracotta: '#C06448',
  white: '#F5F5F5',
  black: '#1C1C1C',
  navy: '#1B2848',
  cobalt: '#0047AB',
  'royal blue': '#4169E1',
  'dark blue': '#00008B',
  'light blue': '#ADD8E6',
  'pale blue': '#C5DCE8',
  blue: '#2255AA',
  indigo: '#3D3B8E',
  teal: '#217A6C',
  red: '#C82828',
  burgundy: '#7D1020',
  wine: '#6E2635',
  maroon: '#7A0030',
  coral: '#E8604A',
  pink: '#F48FB1',
  purple: '#7B1FA2',
  violet: '#5E35B1',
  green: '#2D7D32',
  'forest green': '#1A5C22',
  yellow: '#F5C200',
  mustard: '#C89A10',
  orange: '#E65100',
};

/**
 * Resolves a free-text dominant-color name (e.g. "Navy", "off-white",
 * "Neutral") to a display hex, or null when the name isn't recognized —
 * callers should omit the swatch rather than guess a color. Case- and
 * whitespace-insensitive; "Neutral" (the backend's own fallback for items
 * with no real color data) intentionally has no mapping.
 */
export function resolveOutfitColorHex(colorName: string | null | undefined): string | null {
  if (!colorName) return null;
  const key = colorName.trim().toLowerCase();
  return OUTFIT_COLOR_HEX[key] ?? null;
}
