// ── Deterministic fragrance recommendation ───────────────────────────────────
//
// CRITICAL INVARIANT (spec section 41): this module has ZERO dependency on
// any LLM client, image recognition, sketch generator, or HTTP fragrance
// provider. Every import below is either a local pure type/function or a
// Node builtin. Profiling and sketch generation happen once, at ingestion
// (fragrance-profile.service.ts / fragrance-sketch.service.ts) — this module
// only ever reads already-persisted scores and does in-memory arithmetic.
// If a future edit needs to import from ai/ or any *.service.ts that itself
// touches openai-client.ts, that import belongs in a DIFFERENT module.

import type { FragranceVibe } from './fragrance-types.js';

export type ScorableFragrance = {
  id: string;
  brand: string;
  name: string;
  concentration: string | null;
  topNotes: string[] | null;
  middleNotes: string[] | null;
  baseNotes: string[] | null;
  mainAccords: { name: string; weight: number }[] | null;
  primaryVibe: string | null;
  secondaryVibes: string[] | null;
  seasonality: Record<string, number> | null;
  dayNight: Record<string, number> | null;
  formality: Record<string, number> | null;
};

export type OwnedFragrance = {
  userFragranceId: string;
  isSignature: boolean;
  currentVolumeMl: number | null;
  fragrance: ScorableFragrance;
};

export type RecommendationContext = {
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  temperatureC?: number;
  /** 'casual' | 'smart-casual' | 'business' — the outfit's own formality tier. */
  formalityTier?: string;
  isFormalEvening?: boolean;
  dayNight?: 'day' | 'night';
  /** Best-effort freeform aesthetic signal (vibeKeywords, styleVibe, dayType, etc.) — matched against the fixed vibe taxonomy by keyword, never a second taxonomy. */
  aestheticText?: string;
  /** Only passed when the caller already has reliable resolved-piece color metadata — never computed here. */
  outfitColorFamily?: string;
  /**
   * User's best-fit ↔ variety preference, 0–100 (default 0 = pure best fit,
   * byte-identical to the original deterministic behavior). Widens the
   * qualifying pool from "only the top scorer" toward "the full eligible
   * set" — scaled to this request's own observed score spread, not a fixed
   * point value — then picks among that pool with score-weighted randomness
   * so better fits still surface more often. See pickQualifyingPool's
   * comment for why the band is relative rather than absolute.
   */
  varietyLevel?: number;
};

export type FragranceRecommendation = {
  userFragranceId: string;
  fragranceId: string;
  brand: string;
  name: string;
  concentration: string | null;
  keyAccords: string[];
  primaryVibe: string | null;
  reason: string;
};

// ── Eligibility (section 23) ─────────────────────────────────────────────────

export function isEligible(owned: OwnedFragrance): boolean {
  // currentVolumeMl === 0 → excluded (empty bottle). null → unknown quantity,
  // still eligible. Manual (unprofiled beyond minimum) fragrances remain
  // eligible as long as they exist as a catalog row at all.
  return owned.currentVolumeMl !== 0;
}

// ── Weather / season scoring — 40 points (section 25) ────────────────────────

const LIGHT_ACCORD_KEYWORDS = ['citrus', 'aquatic', 'marine', 'green', 'aromatic', 'tea', 'fresh', 'musk', 'clean'];
const HEAVY_ACCORD_KEYWORDS = ['gourmand', 'amber', 'leather', 'tobacco', 'resin', 'smoky', 'sweet', 'vanilla', 'spicy', 'spice'];

function sumMatchingAccordWeights(accords: { name: string; weight: number }[], keywords: string[]): number {
  return accords.reduce((sum, accord) => {
    const nameLower = accord.name.toLowerCase();
    return keywords.some((kw) => nameLower.includes(kw)) ? sum + accord.weight : sum;
  }, 0);
}

function scoreWeatherSeason(fragrance: ScorableFragrance, context: RecommendationContext): number {
  // Base 30 pts: the fragrance's own profiled per-season suitability.
  let score: number;
  if (context.season && fragrance.seasonality) {
    score = (fragrance.seasonality[context.season] ?? 0.5) * 30;
  } else {
    score = 15;
  }

  // Adjustment ±10 pts: accord-level warm/cold fit, bonuses/penalties only —
  // never a hard exclusion.
  if (context.temperatureC != null && fragrance.mainAccords && fragrance.mainAccords.length > 0) {
    const isWarm = context.temperatureC >= 20;
    const isCold = context.temperatureC <= 10;
    if (isWarm || isCold) {
      const lightWeight = sumMatchingAccordWeights(fragrance.mainAccords, LIGHT_ACCORD_KEYWORDS);
      const heavyWeight = sumMatchingAccordWeights(fragrance.mainAccords, HEAVY_ACCORD_KEYWORDS);
      score += isWarm ? (lightWeight - heavyWeight) * 10 : (heavyWeight - lightWeight) * 10;
    }
  }

  return Math.max(0, Math.min(40, score));
}

// ── Formality scoring — 25 points (section 26) ───────────────────────────────

function formalityKeyForTier(tier: string | undefined, isFormalEvening: boolean | undefined): 'casual' | 'smartCasual' | 'business' | 'formalEvening' {
  if (isFormalEvening) return 'formalEvening';
  if (tier === 'business') return 'business';
  if (tier === 'smart-casual' || tier === 'smartCasual') return 'smartCasual';
  return 'casual';
}

function scoreFormality(fragrance: ScorableFragrance, context: RecommendationContext): number {
  if (!fragrance.formality) return 12.5;
  const key = formalityKeyForTier(context.formalityTier, context.isFormalEvening);
  return (fragrance.formality[key] ?? 0.5) * 25;
}

// ── Vibe / aesthetic scoring — 20 points (section 27) ────────────────────────

const VIBE_KEYWORDS: Record<FragranceVibe, string[]> = {
  FRESH_CLEAN: ['clean', 'fresh', 'minimal', 'crisp', 'simple', 'light'],
  WARM_COZY: ['cozy', 'warm', 'comfort', 'soft', 'relaxed'],
  DARK_SEDUCTIVE: ['dark', 'seductive', 'moody', 'sultry', 'night', 'sexy'],
  WOODY_EARTHY: ['earthy', 'rugged', 'outdoor', 'woody', 'natural', 'adventure'],
  GOURMAND_SWEET: ['sweet', 'dessert', 'gourmand', 'indulgent'],
  AROMATIC_SPORTY: ['sporty', 'athletic', 'active', 'casual', 'weekend'],
  FLORAL_ROMANTIC: ['romantic', 'floral', 'date', 'soft'],
  SPICY_CONFIDENT: ['bold', 'confident', 'statement', 'spicy', 'edgy', 'fashion-forward', 'expressive'],
};

/** Best-effort match of freeform outfit text to the fixed vibe taxonomy — not a second taxonomy, just a lookup. Returns null when no keyword matches (no penalty applied in that case). */
export function matchOutfitVibe(aestheticText: string | undefined): FragranceVibe | null {
  if (!aestheticText?.trim()) return null;
  const haystack = aestheticText.toLowerCase();
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS) as [FragranceVibe, string[]][]) {
    if (keywords.some((kw) => haystack.includes(kw))) return vibe;
  }
  return null;
}

function scoreVibe(fragrance: ScorableFragrance, context: RecommendationContext): number {
  const outfitVibe = matchOutfitVibe(context.aestheticText);
  if (!outfitVibe) return 10;
  if (fragrance.primaryVibe === outfitVibe) return 20;
  if (fragrance.secondaryVibes?.includes(outfitVibe)) return 14;
  return 6;
}

// ── Day / night scoring — 10 points (section 28) ─────────────────────────────

function scoreDayNight(fragrance: ScorableFragrance, context: RecommendationContext): number {
  // Unknown time applies NO meaningful penalty — neutral half credit, not a guess.
  if (!context.dayNight || !fragrance.dayNight) return 5;
  return (fragrance.dayNight[context.dayNight] ?? 0.5) * 10;
}

// ── Color synergy bonus — up to 5 points (section 24) ────────────────────────
//
// Deliberately tiny and conservative — only engages when the caller already
// has reliable resolved-outfit color data (no new color-analysis subsystem
// built for this). Absent outfitColorFamily, this always contributes 0.

const COLOR_ACCORD_AFFINITY: Record<string, string[]> = {
  brown: ['woody', 'leather', 'tobacco', 'amber'],
  white: ['citrus', 'aquatic', 'fresh', 'musk'],
  black: ['spicy', 'smoky', 'leather', 'dark'],
  navy: ['aromatic', 'aquatic', 'woody'],
  green: ['green', 'aromatic', 'citrus'],
  beige: ['woody', 'amber', 'musk'],
};

function scoreColorSynergy(fragrance: ScorableFragrance, context: RecommendationContext): number {
  if (!context.outfitColorFamily || !fragrance.mainAccords) return 0;
  const affinity = COLOR_ACCORD_AFFINITY[context.outfitColorFamily.toLowerCase()];
  if (!affinity) return 0;
  const matchWeight = sumMatchingAccordWeights(fragrance.mainAccords, affinity);
  return Math.min(5, matchWeight * 5);
}

// ── Scoring + selection ───────────────────────────────────────────────────────

type ScoredFragrance = {
  owned: OwnedFragrance;
  total: number;
  weatherSeason: number;
  formality: number;
};

function scoreOne(owned: OwnedFragrance, context: RecommendationContext): ScoredFragrance {
  const weatherSeason = scoreWeatherSeason(owned.fragrance, context);
  const formality = scoreFormality(owned.fragrance, context);
  const vibe = scoreVibe(owned.fragrance, context);
  const dayNight = scoreDayNight(owned.fragrance, context);
  const colorBonus = scoreColorSynergy(owned.fragrance, context);
  return { owned, total: weatherSeason + formality + vibe + dayNight + colorBonus, weatherSeason, formality };
}

/**
 * Deterministic tie-break (section 29) — never randomized, and never
 * influenced by isSignature. isSignature is purely a user-facing label (the
 * star in the closet UI) — it does not contribute to scoring or break ties
 * here, so marking a fragrance as a signature scent never biases it toward
 * being recommended more often.
 *
 * This ordering is still the canonical "best fit first" ranking used by
 * variety mode below (section 33) to build its qualifying pool — variety
 * mode's randomness is scoped entirely to *which* member of that pool gets
 * picked, never to how the pool itself is ranked or bounded.
 */
function compareCandidates(a: ScoredFragrance, b: ScoredFragrance): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.weatherSeason !== b.weatherSeason) return b.weatherSeason - a.weatherSeason;
  if (a.formality !== b.formality) return b.formality - a.formality;
  const nameA = `${a.owned.fragrance.brand} ${a.owned.fragrance.name}`;
  const nameB = `${b.owned.fragrance.brand} ${b.owned.fragrance.name}`;
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  return a.owned.fragrance.id < b.owned.fragrance.id ? -1 : 1;
}

// ── Reason string (section 30) — deterministic, no LLM ───────────────────────

function pickKeyAccords(fragrance: ScorableFragrance): string[] {
  if (!fragrance.mainAccords?.length) return [];
  return [...fragrance.mainAccords].sort((a, b) => b.weight - a.weight).slice(0, 3).map((a) => a.name);
}

function buildReason(scored: ScoredFragrance, context: RecommendationContext): string {
  const accords = pickKeyAccords(scored.owned.fragrance);
  const accordPhrase = accords.length > 0 ? accords.slice(0, 2).join(' and ') : 'its character';

  // Lead with whichever dimension contributed most, for a genuinely
  // fragrance-specific (not generic) sentence.
  const dims: { key: 'weather' | 'formality'; value: number }[] = [
    { key: 'weather', value: scored.weatherSeason },
    { key: 'formality', value: scored.formality },
  ];
  const leading = dims.sort((a, b) => b.value - a.value)[0]!.key;

  if (leading === 'formality' && scored.formality >= 20) {
    return `Its ${accordPhrase} profile brings a refined, considered finish that matches how dressed-up this look is.`;
  }
  if (context.temperatureC != null && context.temperatureC >= 20) {
    return `Its ${accordPhrase} profile keeps things fresh and polished for the warmer weather.`;
  }
  if (context.temperatureC != null && context.temperatureC <= 10) {
    return `Its ${accordPhrase} profile adds a warmer, richer finish suited to the cooler weather.`;
  }
  return `Its ${accordPhrase} profile complements this look's overall character.`;
}

// ── Variety selection (section 33) ────────────────────────────────────────────
//
// Opt-in, off by default (varietyLevel 0 or absent behaves byte-identical to
// the original single-winner selection — same candidate, same reason string).
// Above 0, the qualifying pool widens from "only the top scorer" toward "the
// full eligible set," and the pick within that pool is score-weighted random
// rather than always the single best.
//
// The band is sized relative to the *observed* spread between the best and
// worst eligible score for this request (topScore - bottomScore), not a
// fixed point value out of the theoretical 0-100 scale. A fixed absolute
// band silently degenerates to "only ever the top scorer" whenever a
// closet's real score spread exceeds it — e.g. one fully AI-profiled,
// broadly-suitable fragrance sitting 50+ points above several manually-added
// fragrances that never got profiled (and so score at the scheme's flat
// neutral defaults) — which is exactly the "variety maxed out and it's
// still always the same fragrance" failure mode. Scaling to the observed
// spread instead means varietyLevel 100 always pulls in the whole eligible
// set (still weighted toward the better fits by weightedPick below), so
// rotation is guaranteed regardless of how wide that gap happens to be.
function pickQualifyingPool(scored: ScoredFragrance[], varietyLevel: number): ScoredFragrance[] {
  const variety = Math.max(0, Math.min(100, varietyLevel));
  if (variety <= 0) return [scored[0]!];
  const topScore = scored[0]!.total;
  const bottomScore = scored[scored.length - 1]!.total;
  const bandWidth = (variety / 100) * (topScore - bottomScore);
  if (bandWidth <= 0) return [scored[0]!]; // every eligible fragrance is exactly tied
  return scored.filter((s) => topScore - s.total <= bandWidth);
}

/** Score-weighted random pick — never uniform, so the top of the pool still surfaces most often. */
function weightedPick(pool: ScoredFragrance[], random: () => number): ScoredFragrance {
  if (pool.length === 1) return pool[0]!;
  // Shift weights so the lowest-scoring pool member still has some (small,
  // non-zero) chance — a raw `total` weight would starve anything near 0.
  const floor = Math.min(...pool.map((s) => s.total));
  const weights = pool.map((s) => s.total - floor + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

// ── Entry point ────────────────────────────────────────────────────────────────

/**
 * Pure, synchronous. Candidates are ALWAYS restricted to ownedFragrances as
 * passed in by the caller — this function never queries anything itself, so
 * an unowned fragrance can never be recommended as long as the caller only
 * passes the authenticated user's own owned fragrances (see
 * fragrance-recommendation-integration — the caller-side contract).
 *
 * Deterministic unless context.varietyLevel > 0 AND more than one fragrance
 * qualifies for the resulting band — the default (varietyLevel 0/absent)
 * path never calls `random` at all. `random` is injectable (defaults to
 * Math.random) purely so variety mode stays unit-testable.
 */
export function recommendFragrance(input: {
  ownedFragrances: OwnedFragrance[];
  context: RecommendationContext;
  random?: () => number;
}): FragranceRecommendation | null {
  const eligible = input.ownedFragrances.filter(isEligible);
  if (eligible.length === 0) return null;

  const scored = eligible.map((owned) => scoreOne(owned, input.context)).sort(compareCandidates);
  const pool = pickQualifyingPool(scored, input.context.varietyLevel ?? 0);
  const winner = weightedPick(pool, input.random ?? Math.random);

  return {
    userFragranceId: winner.owned.userFragranceId,
    fragranceId: winner.owned.fragrance.id,
    brand: winner.owned.fragrance.brand,
    name: winner.owned.fragrance.name,
    concentration: winner.owned.fragrance.concentration,
    keyAccords: pickKeyAccords(winner.owned.fragrance),
    primaryVibe: winner.owned.fragrance.primaryVibe,
    reason: buildReason(winner, input.context),
  };
}
