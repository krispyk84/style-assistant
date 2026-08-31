// Outfit pieces carry a free-text color descriptor (OutfitPieceMeta.color —
// "navy", "ecru", "tobacco"...), not a hex value. This is a lightweight
// keyword→approximate-hex lookup so the UI can show a very subtle color
// accent per piece without a new AI/data pipeline — deliberately approximate,
// not a color-matching system.

const COLOR_KEYWORDS: [string, string][] = [
  ['navy', '#1F2A44'],
  ['midnight', '#151B2E'],
  ['black', '#1A1A1A'],
  ['charcoal', '#3A3A3A'],
  ['grey', '#8A8A85'],
  ['gray', '#8A8A85'],
  ['white', '#F5F3EE'],
  ['ivory', '#F2EAD8'],
  ['cream', '#F0E6D0'],
  ['ecru', '#DCCBA6'],
  ['chalk', '#EDE7DA'],
  ['stone', '#C9BFAE'],
  ['sand', '#D9C3A0'],
  ['beige', '#D8C4A0'],
  ['camel', '#C19A6B'],
  ['tan', '#C4A268'],
  ['tobacco', '#8B5A3C'],
  ['khaki', '#A99A6B'],
  ['olive', '#6E7449'],
  ['forest', '#33452F'],
  ['green', '#4C6444'],
  ['sage', '#9CAA8C'],
  ['burgundy', '#5E2129'],
  ['maroon', '#5C2028'],
  ['wine', '#5E2436'],
  ['red', '#A63C36'],
  ['rust', '#A85628'],
  ['brick', '#A6503A'],
  ['brown', '#5A4230'],
  ['chocolate', '#43301F'],
  ['espresso', '#3B2A1D'],
  ['blue', '#3D5A80'],
  ['denim', '#4A6480'],
  ['powder', '#A9C0D0'],
  ['sky', '#8FB4CC'],
  ['teal', '#2E6B67'],
  ['pink', '#D9A0A5'],
  ['blush', '#E3C4C0'],
  ['coral', '#D97A5E'],
  ['orange', '#C97A3A'],
  ['mustard', '#C79A34'],
  ['gold', '#B8933F'],
  ['yellow', '#D6B24D'],
  ['purple', '#5F4B66'],
  ['lavender', '#A79AB8'],
  ['silver', '#B8B8B2'],
];

/** Approximate swatch color for a free-text color descriptor, or null if nothing matches. */
export function colorSwatchHex(colorText: string | null | undefined): string | null {
  if (!colorText) return null;
  const lower = colorText.toLowerCase();
  for (const [keyword, hex] of COLOR_KEYWORDS) {
    if (lower.includes(keyword)) return hex;
  }
  return null;
}
