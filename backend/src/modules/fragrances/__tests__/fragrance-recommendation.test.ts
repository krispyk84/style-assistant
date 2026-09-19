import { describe, it, expect } from 'vitest';

import { isEligible, matchOutfitVibe, recommendFragrance } from '../fragrance-recommendation.service.js';
import type { OwnedFragrance, RecommendationContext, ScorableFragrance } from '../fragrance-recommendation.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFragrance(overrides: Partial<ScorableFragrance> = {}): ScorableFragrance {
  return {
    id: overrides.id ?? 'frag-default',
    brand: overrides.brand ?? 'Test House',
    name: overrides.name ?? 'Test Scent',
    concentration: overrides.concentration ?? 'Eau de Parfum',
    topNotes: overrides.topNotes ?? null,
    middleNotes: overrides.middleNotes ?? null,
    baseNotes: overrides.baseNotes ?? null,
    mainAccords: overrides.mainAccords ?? null,
    primaryVibe: overrides.primaryVibe ?? null,
    secondaryVibes: overrides.secondaryVibes ?? null,
    seasonality: overrides.seasonality ?? null,
    dayNight: overrides.dayNight ?? null,
    formality: overrides.formality ?? null,
  };
}

function makeOwned(overrides: Partial<OwnedFragrance> = {}, fragranceOverrides: Partial<ScorableFragrance> = {}): OwnedFragrance {
  return {
    userFragranceId: overrides.userFragranceId ?? 'owned-default',
    isSignature: overrides.isSignature ?? false,
    currentVolumeMl: overrides.currentVolumeMl ?? 50,
    fragrance: makeFragrance(fragranceOverrides),
  };
}

// ── Eligibility (spec section 23) ────────────────────────────────────────────

describe('isEligible', () => {
  it('excludes a fragrance with currentVolumeMl === 0 (empty bottle)', () => {
    expect(isEligible(makeOwned({ currentVolumeMl: 0 }))).toBe(false);
  });

  it('treats currentVolumeMl === null (unknown quantity) as eligible', () => {
    expect(isEligible(makeOwned({ currentVolumeMl: null }))).toBe(true);
  });

  it('treats a positive currentVolumeMl as eligible', () => {
    expect(isEligible(makeOwned({ currentVolumeMl: 10 }))).toBe(true);
  });
});

// ── Vibe keyword matching ────────────────────────────────────────────────────

describe('matchOutfitVibe', () => {
  it('returns null for empty/whitespace-only text', () => {
    expect(matchOutfitVibe(undefined)).toBeNull();
    expect(matchOutfitVibe('   ')).toBeNull();
  });

  it('returns null when no keyword matches any vibe', () => {
    expect(matchOutfitVibe('xyzzy plugh')).toBeNull();
  });

  it('matches SPICY_CONFIDENT for bold/statement language', () => {
    expect(matchOutfitVibe('a bold, statement-making evening look')).toBe('SPICY_CONFIDENT');
  });
});

// ── No inventory ──────────────────────────────────────────────────────────────

describe('recommendFragrance — no inventory', () => {
  it('returns null when the user owns no fragrances', () => {
    expect(recommendFragrance({ ownedFragrances: [], context: {} })).toBeNull();
  });

  it('returns null when every owned fragrance is ineligible (all bottles empty)', () => {
    const owned = [makeOwned({ currentVolumeMl: 0 }, { id: 'a' })];
    expect(recommendFragrance({ ownedFragrances: owned, context: {} })).toBeNull();
  });
});

// ── Unowned fragrances never surface ─────────────────────────────────────────

describe('recommendFragrance — candidate scope', () => {
  it('never recommends a fragrance outside the passed-in ownedFragrances list', () => {
    const owned = [makeOwned({ userFragranceId: 'u1' }, { id: 'owned-1' })];
    const result = recommendFragrance({ ownedFragrances: owned, context: {} });
    expect(result?.fragranceId).toBe('owned-1');
  });
});

// ── Weather / season + formality scoring ─────────────────────────────────────

describe('recommendFragrance — weather and formality scoring', () => {
  it('prefers the fragrance profiled best for the current season', () => {
    const summerScent = makeOwned({ userFragranceId: 'summer' }, {
      id: 'summer-frag',
      seasonality: { spring: 0.4, summer: 1, fall: 0.3, winter: 0.1 },
    });
    const winterScent = makeOwned({ userFragranceId: 'winter' }, {
      id: 'winter-frag',
      seasonality: { spring: 0.3, summer: 0.1, fall: 0.5, winter: 1 },
    });
    const context: RecommendationContext = { season: 'summer' };
    const result = recommendFragrance({ ownedFragrances: [summerScent, winterScent], context });
    expect(result?.fragranceId).toBe('summer-frag');
  });

  it('gives a light, citrus-forward fragrance a warm-weather accord bonus over a heavy, resinous one', () => {
    const light = makeOwned({ userFragranceId: 'light' }, {
      id: 'light-frag',
      mainAccords: [{ name: 'Citrus', weight: 1 }, { name: 'Aquatic', weight: 0.8 }],
    });
    const heavy = makeOwned({ userFragranceId: 'heavy' }, {
      id: 'heavy-frag',
      mainAccords: [{ name: 'Amber', weight: 1 }, { name: 'Resin', weight: 0.8 }],
    });
    const context: RecommendationContext = { temperatureC: 28 };
    const result = recommendFragrance({ ownedFragrances: [light, heavy], context });
    expect(result?.fragranceId).toBe('light-frag');
  });

  it('prefers the fragrance profiled best for a business-formality outfit', () => {
    const formal = makeOwned({ userFragranceId: 'formal' }, {
      id: 'formal-frag',
      formality: { casual: 0.2, smartCasual: 0.5, business: 1, formalEvening: 0.6 },
    });
    const casual = makeOwned({ userFragranceId: 'casual' }, {
      id: 'casual-frag',
      formality: { casual: 1, smartCasual: 0.5, business: 0.1, formalEvening: 0.1 },
    });
    const context: RecommendationContext = { formalityTier: 'business' };
    const result = recommendFragrance({ ownedFragrances: [formal, casual], context });
    expect(result?.fragranceId).toBe('formal-frag');
  });
});

// ── Deterministic tie-break (spec section 29) ────────────────────────────────

describe('recommendFragrance — tie-break order', () => {
  it('a signature fragrance does not beat a materially better-scoring match', () => {
    const signatureButWorse = makeOwned({ userFragranceId: 'sig', isSignature: true }, {
      id: 'sig-frag',
      seasonality: { spring: 0.1, summer: 0.1, fall: 0.1, winter: 0.1 },
      formality: { casual: 0.1, smartCasual: 0.1, business: 0.1, formalEvening: 0.1 },
    });
    const betterMatch = makeOwned({ userFragranceId: 'better', isSignature: false }, {
      id: 'better-frag',
      seasonality: { spring: 1, summer: 1, fall: 1, winter: 1 },
      formality: { casual: 1, smartCasual: 1, business: 1, formalEvening: 1 },
    });
    const context: RecommendationContext = { season: 'summer', formalityTier: 'business' };
    const result = recommendFragrance({ ownedFragrances: [signatureButWorse, betterMatch], context });
    expect(result?.fragranceId).toBe('better-frag');
  });

  it('breaks an exact score tie in favor of the signature fragrance', () => {
    const identicalProfile: Partial<ScorableFragrance> = {
      seasonality: { spring: 0.5, summer: 0.5, fall: 0.5, winter: 0.5 },
      formality: { casual: 0.5, smartCasual: 0.5, business: 0.5, formalEvening: 0.5 },
    };
    const signature = makeOwned({ userFragranceId: 'sig', isSignature: true }, { id: 'a-frag', ...identicalProfile });
    const nonSignature = makeOwned({ userFragranceId: 'non-sig', isSignature: false }, { id: 'b-frag', ...identicalProfile });
    const result = recommendFragrance({ ownedFragrances: [nonSignature, signature], context: {} });
    expect(result?.fragranceId).toBe('a-frag');
  });

  it('falls back to stable brand+name ordering when every other tie-break dimension is equal', () => {
    const identicalProfile: Partial<ScorableFragrance> = {
      seasonality: { spring: 0.5, summer: 0.5, fall: 0.5, winter: 0.5 },
      formality: { casual: 0.5, smartCasual: 0.5, business: 0.5, formalEvening: 0.5 },
    };
    const zFragrance = makeOwned({ userFragranceId: 'z' }, { id: 'z-id', brand: 'Zenith', name: 'Zeta', ...identicalProfile });
    const aFragrance = makeOwned({ userFragranceId: 'a' }, { id: 'a-id', brand: 'Aventura', name: 'Alpha', ...identicalProfile });
    const result = recommendFragrance({ ownedFragrances: [zFragrance, aFragrance], context: {} });
    expect(result?.fragranceId).toBe('a-id');
  });
});

// ── Reason string ──────────────────────────────────────────────────────────────

describe('recommendFragrance — reason string', () => {
  it('always returns a non-empty, deterministic reason', () => {
    const owned = [makeOwned({ userFragranceId: 'u1' }, { id: 'f1', mainAccords: [{ name: 'Citrus', weight: 1 }] })];
    const result = recommendFragrance({ ownedFragrances: owned, context: { temperatureC: 25 } });
    expect(result?.reason).toBeTruthy();
    expect(typeof result?.reason).toBe('string');
  });
});
