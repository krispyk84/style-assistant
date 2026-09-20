import { describe, it, expect } from 'vitest';

import { buildCanonicalKey, normalizeBrand, normalizeName } from '../fragrance-normalize.js';

describe('normalizeBrand / normalizeName', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeBrand('  Le Labo  ')).toBe(normalizeBrand('le labo'));
    expect(normalizeName('  Santal 33  ')).toBe(normalizeName('santal 33'));
  });

  it('collapses internal whitespace differences', () => {
    expect(normalizeName('Santal   33')).toBe(normalizeName('Santal 33'));
  });
});

describe('buildCanonicalKey — catalog dedup', () => {
  it('produces the same key for the same brand/name regardless of casing or spacing', () => {
    const a = buildCanonicalKey('Le Labo', 'Santal 33', 'Eau de Parfum');
    const b = buildCanonicalKey('  le labo  ', 'santal   33', 'eau de parfum');
    expect(a).toBe(b);
  });

  it('produces different keys for different concentrations of the same fragrance', () => {
    const edp = buildCanonicalKey('Dior', 'Sauvage', 'Eau de Parfum');
    const edt = buildCanonicalKey('Dior', 'Sauvage', 'Eau de Toilette');
    expect(edp).not.toBe(edt);
  });

  it('produces different keys for different fragrances', () => {
    const a = buildCanonicalKey('Creed', 'Aventus');
    const b = buildCanonicalKey('Creed', 'Green Irish Tweed');
    expect(a).not.toBe(b);
  });

  it('defaults to a stable "unknown" concentration segment when none is given', () => {
    const withoutConcentration = buildCanonicalKey('Byredo', 'Gypsy Water');
    const withUndefinedConcentration = buildCanonicalKey('Byredo', 'Gypsy Water', undefined);
    expect(withoutConcentration).toBe(withUndefinedConcentration);
  });
});
