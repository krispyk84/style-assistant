import { describe, expect, it } from 'vitest';

import { resolveOutfitColorHex } from '@/lib/outfit-color-swatch';

describe('resolveOutfitColorHex', () => {
  it('resolves a known color name to its display hex', () => {
    expect(resolveOutfitColorHex('Navy')).toBe('#1B2848');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveOutfitColorHex('  NAVY  ')).toBe('#1B2848');
    expect(resolveOutfitColorHex('navy')).toBe('#1B2848');
  });

  it('returns null for an unrecognized color name rather than guessing', () => {
    expect(resolveOutfitColorHex('Glimmering Aurora')).toBeNull();
  });

  it('returns null for the backend\'s own "Neutral" fallback (not a real color)', () => {
    expect(resolveOutfitColorHex('Neutral')).toBeNull();
  });

  it('returns null for missing/empty input', () => {
    expect(resolveOutfitColorHex(null)).toBeNull();
    expect(resolveOutfitColorHex(undefined)).toBeNull();
    expect(resolveOutfitColorHex('')).toBeNull();
  });

  it('resolves light/white colors too, matching the same mapping', () => {
    expect(resolveOutfitColorHex('White')).toBe('#F5F5F5');
    expect(resolveOutfitColorHex('Ivory')).toBe('#F6F0E4');
    expect(resolveOutfitColorHex('Cream')).toBe('#FFFBEF');
  });
});
