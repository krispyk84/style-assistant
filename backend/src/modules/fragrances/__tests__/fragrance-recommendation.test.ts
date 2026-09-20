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
  it('a materially better-scoring match always wins, regardless of isSignature', () => {
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

  it('isSignature never breaks a score tie — marking a fragrance as a signature scent must not bias the recommender toward it', () => {
    const identicalProfile: Partial<ScorableFragrance> = {
      seasonality: { spring: 0.5, summer: 0.5, fall: 0.5, winter: 0.5 },
      formality: { casual: 0.5, smartCasual: 0.5, business: 0.5, formalEvening: 0.5 },
    };
    // Signature scent is alphabetically LAST — if isSignature still influenced the tie-break,
    // it would win despite that; the stable fallback should pick the alphabetically-first one instead.
    const signature = makeOwned({ userFragranceId: 'sig', isSignature: true }, { id: 'z-frag', brand: 'Zenith', name: 'Zeta', ...identicalProfile });
    const nonSignature = makeOwned({ userFragranceId: 'non-sig', isSignature: false }, { id: 'a-frag', brand: 'Aventura', name: 'Alpha', ...identicalProfile });
    const result = recommendFragrance({ ownedFragrances: [signature, nonSignature], context: {} });
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

// ── Variety mode (spec section 33) ───────────────────────────────────────────

describe('recommendFragrance — variety mode', () => {
  it('varietyLevel 0 (and absent) is byte-identical to the original single-winner pick, and never calls random', () => {
    const best = makeOwned({ userFragranceId: 'best' }, { id: 'best-frag', seasonality: { spring: 1, summer: 1, fall: 1, winter: 1 } });
    const worse = makeOwned({ userFragranceId: 'worse' }, { id: 'worse-frag', seasonality: { spring: 0.9, summer: 0.9, fall: 0.9, winter: 0.9 } });
    const random = () => { throw new Error('random must not be called when varietyLevel is 0/absent'); };

    const absent = recommendFragrance({ ownedFragrances: [worse, best], context: {}, random });
    expect(absent?.fragranceId).toBe('best-frag');

    const explicitZero = recommendFragrance({ ownedFragrances: [worse, best], context: { varietyLevel: 0 }, random });
    expect(explicitZero?.fragranceId).toBe('best-frag');
  });

  it('at varietyLevel 100, even a much weaker fit is reachable — the band scales to the observed score spread, not a fixed cap (regression: a large real-world gap, e.g. one fully-profiled fragrance vs. several unprofiled ones, used to leave the pool stuck at size 1 regardless of the slider)', () => {
    const best = makeOwned({ userFragranceId: 'best' }, { id: 'best-frag', seasonality: { spring: 1, summer: 1, fall: 1, winter: 1 }, formality: { casual: 1, smartCasual: 1, business: 1, formalEvening: 1 } });
    const farWorse = makeOwned({ userFragranceId: 'far-worse' }, { id: 'far-worse-frag', seasonality: { spring: 0, summer: 0, fall: 0, winter: 0 }, formality: { casual: 0, smartCasual: 0, business: 0, formalEvening: 0 } });
    const context: RecommendationContext = { season: 'summer', formalityTier: 'business', varietyLevel: 100 };
    // A high roll reaches all the way to farWorse — proving the pool includes the full range at 100...
    const highRoll = recommendFragrance({ ownedFragrances: [best, farWorse], context, random: () => 0.9999 });
    expect(highRoll?.fragranceId).toBe('far-worse-frag');
    // ...while a low roll still lands on the top scorer — the weighting still favors the better fit.
    const lowRoll = recommendFragrance({ ownedFragrances: [best, farWorse], context, random: () => 0 });
    expect(lowRoll?.fragranceId).toBe('best-frag');
  });

  it('at varietyLevel 100, a MODERATE roll (not just the extreme edge) reaches a much-lower-scoring pool member — weighting flattens toward uniform, so a large real score gap cannot make the top scorer win nearly every draw (regression: a big gap left the top scorer overwhelmingly likely even after the pool was widened, which reads as "variety does nothing" even though a different pick was technically possible — e.g. always getting the same fragrance across 5 independently-generated outfits)', () => {
    const best = makeOwned({ userFragranceId: 'best' }, { id: 'best-frag', seasonality: { spring: 1, summer: 1, fall: 1, winter: 1 }, formality: { casual: 1, smartCasual: 1, business: 1, formalEvening: 1 } });
    const farWorse = makeOwned({ userFragranceId: 'far-worse' }, { id: 'far-worse-frag', seasonality: { spring: 0, summer: 0, fall: 0, winter: 0 }, formality: { casual: 0, smartCasual: 0, business: 0, formalEvening: 0 } });
    const context: RecommendationContext = { season: 'summer', formalityTier: 'business', varietyLevel: 100 };
    // best/farWorse score 70/15 here — under the old raw-score weighting (56:1) this roll would
    // still have landed on best; under uniform-at-100 weighting (50:50) it crosses to farWorse.
    const result = recommendFragrance({ ownedFragrances: [best, farWorse], context, random: () => 0.51 });
    expect(result?.fragranceId).toBe('far-worse-frag');
  });

  it('at high varietyLevel, a close-second strong fit can be selected instead of the single best', () => {
    const best = makeOwned({ userFragranceId: 'best' }, { id: 'best-frag', seasonality: { spring: 1, summer: 1, fall: 1, winter: 1 } });
    const closeSecond = makeOwned({ userFragranceId: 'close-second' }, { id: 'close-second-frag', seasonality: { spring: 0.95, summer: 0.95, fall: 0.95, winter: 0.95 } });
    const context: RecommendationContext = { season: 'summer', varietyLevel: 100 };
    // random() returns just under 1 — with two near-equal weights, this rolls onto the second pool member.
    const result = recommendFragrance({ ownedFragrances: [best, closeSecond], context, random: () => 0.9999 });
    expect(result?.fragranceId).toBe('close-second-frag');
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
