import { describe, it, expect } from 'vitest';

import {
  accordNamesToAccords,
  accordsToNames,
  buildManualFragrancePayload,
  buildProfileOverrides,
  dimensionDictToSelected,
  identityMatchesResolved,
  selectedToDimensionDict,
  EMPTY_FRAGRANCE_FORM_FIELDS,
  type FragranceFormFields,
} from '@/lib/fragrance-form-mappers';
import type { Fragrance } from '@/types/fragrance';

function baseFragrance(overrides: Partial<Fragrance> = {}): Fragrance {
  return {
    id: 'frag-1',
    brand: 'Le Labo',
    name: 'Santal 33',
    concentration: 'Eau de Parfum',
    topNotes: null,
    middleNotes: null,
    baseNotes: null,
    mainAccords: null,
    primaryVibe: null,
    secondaryVibes: null,
    seasonality: null,
    dayNight: null,
    formality: null,
    profileSource: 'llm',
    profileConfidence: 0.9,
    ...overrides,
  };
}

function baseFields(overrides: Partial<FragranceFormFields> = {}): FragranceFormFields {
  return { ...EMPTY_FRAGRANCE_FORM_FIELDS, brand: 'Le Labo', name: 'Santal 33', concentration: 'Eau de Parfum', ...overrides };
}

describe('selectedToDimensionDict / dimensionDictToSelected', () => {
  it('round-trips a selection through the 0-1 dict representation', () => {
    const dict = selectedToDimensionDict(['summer', 'fall']);
    expect(dict).toEqual({ summer: 1, fall: 1 });
    expect(dimensionDictToSelected(dict, ['spring', 'summer', 'fall', 'winter'])).toEqual(['summer', 'fall']);
  });

  it('returns undefined for an empty selection (omitted, not an explicit exclusion)', () => {
    expect(selectedToDimensionDict([])).toBeUndefined();
  });

  it('treats values >= 0.5 as "on" when reading back an AI-profiled weighted dict', () => {
    const dict = { spring: 0.6, summer: 0.4, fall: 0.5, winter: 0 };
    expect(dimensionDictToSelected(dict, ['spring', 'summer', 'fall', 'winter'])).toEqual(['spring', 'fall']);
  });

  it('returns an empty array for a null/undefined dict', () => {
    expect(dimensionDictToSelected(null, ['spring', 'summer'])).toEqual([]);
    expect(dimensionDictToSelected(undefined, ['spring', 'summer'])).toEqual([]);
  });
});

describe('accordNamesToAccords / accordsToNames', () => {
  it('round-trips names through equal-weight accord objects', () => {
    const accords = accordNamesToAccords(['Citrus', 'Amber']);
    expect(accords).toEqual([{ name: 'Citrus', weight: 1 }, { name: 'Amber', weight: 1 }]);
    expect(accordsToNames(accords)).toEqual(['Citrus', 'Amber']);
  });

  it('drops blank entries and returns undefined for an all-blank list', () => {
    expect(accordNamesToAccords(['', '  '])).toBeUndefined();
  });

  it('accordsToNames handles null/undefined gracefully', () => {
    expect(accordsToNames(null)).toEqual([]);
    expect(accordsToNames(undefined)).toEqual([]);
  });
});

describe('buildManualFragrancePayload', () => {
  it('builds a payload with trimmed brand/name and dimension dicts from the form selections', () => {
    const fields = baseFields({
      brand: '  Le Labo  ',
      name: '  Santal 33  ',
      primaryVibe: 'WOODY_EARTHY',
      seasons: ['fall', 'winter'],
      formalityTags: ['smartCasual'],
    });
    const payload = buildManualFragrancePayload(fields);
    expect(payload).toEqual({
      brand: 'Le Labo',
      name: 'Santal 33',
      concentration: 'Eau de Parfum',
      primaryVibe: 'WOODY_EARTHY',
      secondaryVibes: undefined,
      seasonality: { fall: 1, winter: 1 },
      formality: { smartCasual: 1 },
    });
  });
});

describe('identityMatchesResolved', () => {
  it('matches when brand/name/concentration are unchanged from the resolved catalog fragrance', () => {
    const fragrance = baseFragrance();
    const fields = baseFields();
    expect(identityMatchesResolved(fields, fragrance)).toBe(true);
  });

  it('is case/whitespace-insensitive for brand and name', () => {
    const fragrance = baseFragrance();
    const fields = baseFields({ brand: '  le labo  ', name: '  SANTAL 33  ' });
    expect(identityMatchesResolved(fields, fragrance)).toBe(true);
  });

  it('does not match once the user edits the name away from the resolved fragrance', () => {
    const fragrance = baseFragrance();
    const fields = baseFields({ name: 'Le Labo 33 (corrected)' });
    expect(identityMatchesResolved(fields, fragrance)).toBe(false);
  });

  it('does not match when the concentration was changed', () => {
    const fragrance = baseFragrance();
    const fields = baseFields({ concentration: 'Parfum' });
    expect(identityMatchesResolved(fields, fragrance)).toBe(false);
  });
});

describe('buildProfileOverrides', () => {
  it('returns undefined when the form matches the catalog fragrance exactly (no user edits)', () => {
    const fragrance = baseFragrance({ primaryVibe: 'WOODY_EARTHY', seasonality: { fall: 1 } });
    const fields = baseFields({ primaryVibe: 'WOODY_EARTHY', seasons: ['fall'] });
    expect(buildProfileOverrides(fields, fragrance)).toBeUndefined();
  });

  it('includes only the fields the user actually changed from the catalog values', () => {
    const fragrance = baseFragrance({ primaryVibe: 'WOODY_EARTHY', seasonality: { fall: 1 } });
    const fields = baseFields({ primaryVibe: 'SPICY_CONFIDENT', seasons: ['fall'] });
    const overrides = buildProfileOverrides(fields, fragrance);
    expect(overrides).toEqual({ primaryVibe: 'SPICY_CONFIDENT' });
  });

  it('never mutates the passed-in catalog fragrance object', () => {
    const fragrance = baseFragrance({ primaryVibe: 'WOODY_EARTHY' });
    const snapshot = { ...fragrance };
    const fields = baseFields({ primaryVibe: 'SPICY_CONFIDENT' });
    buildProfileOverrides(fields, fragrance);
    expect(fragrance).toEqual(snapshot);
  });
});
