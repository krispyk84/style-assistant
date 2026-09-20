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
  /**
   * The outfit's own aesthetic classified against the fixed FragranceVibe
   * taxonomy — this is now the DOMINANT scoring signal (section 27). Always
   * produced upstream by the outfit-generation LLM call itself (it already
   * has full context on the pieces it just assembled — classifying vibe
   * there is free, no extra API round-trip), never derived here from
   * freeform text. Absent only for the rare non-LLM code path; scored
   * neutrally in that case, never penalized.
   */
  outfitVibe?: FragranceVibe;
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

// ── Weather / season scoring — 25 points (section 25) ────────────────────────

const LIGHT_ACCORD_KEYWORDS = ['citrus', 'aquatic', 'marine', 'green', 'aromatic', 'tea', 'fresh', 'musk', 'clean'];
// 'oud'/'wood'/'incense'/'agarwood'/'patchouli'/'balsamic' were previously
// missing here — a rich oud's mainAccords are very often literally named
// "Oud"/"Woody" with nothing else matching, which meant a temperature
// mismatch never got penalized at all for exactly the fragrances where it
// matters most.
const HEAVY_ACCORD_KEYWORDS = [
  'gourmand', 'amber', 'leather', 'tobacco', 'resin', 'smoky', 'sweet', 'vanilla', 'spicy', 'spice',
  'oud', 'wood', 'incense', 'agarwood', 'patchouli', 'balsamic',
];

function sumMatchingAccordWeights(accords: { name: string; weight: number }[], keywords: string[]): number {
  return accords.reduce((sum, accord) => {
    const nameLower = accord.name.toLowerCase();
    return keywords.some((kw) => nameLower.includes(kw)) ? sum + accord.weight : sum;
  }, 0);
}

/**
 * How far past the neutral 10-20°C shoulder band the temperature sits, as a
 * 0-1 ramp in each direction — 0 right at the edge of the band, reaching 1
 * at genuinely hot (35°C+) or cold (-5°C or below) extremes. Continuous
 * rather than a flat "past this threshold" bonus/penalty, so a scorching
 * 38°C day penalizes a heavy fragrance harder than a mild 21°C one — and,
 * critically, this is driven by the request's actual temperatureC, not
 * calendar season, so a hot day in nominal fall/spring is still treated as
 * hot (see RecommendationContext.temperatureC's callers — always the real
 * forecast/apparent temperature, never derived from the season label).
 */
function temperatureExtremity(temperatureC: number): { warm: number; cold: number } {
  return {
    warm: temperatureC > 20 ? Math.min(1, (temperatureC - 20) / 15) : 0,
    cold: temperatureC < 10 ? Math.min(1, (10 - temperatureC) / 15) : 0,
  };
}

function scoreWeatherSeason(fragrance: ScorableFragrance, context: RecommendationContext): number {
  // Base 18.75 pts (75% of this dimension's 25-pt max): the fragrance's own
  // profiled per-season suitability.
  let score: number;
  if (context.season && fragrance.seasonality) {
    score = (fragrance.seasonality[context.season] ?? 0.5) * 18.75;
  } else {
    score = 9.375;
  }

  // Adjustment, scaled by how extreme the actual temperature is (up to the
  // same 18.75-pt magnitude as the base — a strong accord mismatch at a
  // genuine extreme can cancel out an otherwise-good seasonality profile,
  // though still not an outright ban: other dimensions can still lift a
  // fragrance back up, and a fragrance whose own profiled seasonality
  // disagrees with the accord-keyword heuristic isn't zeroed out either.
  if (context.temperatureC != null && fragrance.mainAccords && fragrance.mainAccords.length > 0) {
    const { warm, cold } = temperatureExtremity(context.temperatureC);
    const intensity = Math.max(warm, cold);
    if (intensity > 0) {
      const lightWeight = sumMatchingAccordWeights(fragrance.mainAccords, LIGHT_ACCORD_KEYWORDS);
      const heavyWeight = sumMatchingAccordWeights(fragrance.mainAccords, HEAVY_ACCORD_KEYWORDS);
      const direction = warm >= cold ? (lightWeight - heavyWeight) : (heavyWeight - lightWeight);
      score += direction * intensity * 18.75;
    }
  }

  return Math.max(0, Math.min(25, score));
}

// ── Formality scoring — 20 points (section 26) ───────────────────────────────

function formalityKeyForTier(tier: string | undefined, isFormalEvening: boolean | undefined): 'casual' | 'smartCasual' | 'business' | 'formalEvening' {
  if (isFormalEvening) return 'formalEvening';
  if (tier === 'business') return 'business';
  if (tier === 'smart-casual' || tier === 'smartCasual') return 'smartCasual';
  return 'casual';
}

function scoreFormality(fragrance: ScorableFragrance, context: RecommendationContext): number {
  if (!fragrance.formality) return 10;
  const key = formalityKeyForTier(context.formalityTier, context.isFormalEvening);
  return (fragrance.formality[key] ?? 0.5) * 20;
}

// ── Vibe scoring — 40 points, the dominant signal (section 27) ───────────────
//
// context.outfitVibe is classified upstream, by the same LLM call that
// designed the outfit itself, against the fixed FragranceVibe taxonomy — see
// RecommendationContext.outfitVibe's comment. This module stays a pure
// lookup against that already-classified value; it never runs its own
// classification (that would need an LLM, which this module can never
// depend on — spec section 41).

function scoreVibe(fragrance: ScorableFragrance, context: RecommendationContext): number {
  if (!context.outfitVibe) return 20;
  if (fragrance.primaryVibe === context.outfitVibe) return 40;
  if (fragrance.secondaryVibes?.includes(context.outfitVibe)) return 28;
  return 12;
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
  vibe: number;
};

function scoreOne(owned: OwnedFragrance, context: RecommendationContext): ScoredFragrance {
  const weatherSeason = scoreWeatherSeason(owned.fragrance, context);
  const formality = scoreFormality(owned.fragrance, context);
  const vibe = scoreVibe(owned.fragrance, context);
  const dayNight = scoreDayNight(owned.fragrance, context);
  const colorBonus = scoreColorSynergy(owned.fragrance, context);
  return { owned, total: weatherSeason + formality + vibe + dayNight + colorBonus, weatherSeason, formality, vibe };
}

/**
 * Deterministic tie-break (section 29) — never randomized, and never
 * influenced by isSignature. isSignature is purely a user-facing label (the
 * star in the closet UI) — it does not contribute to scoring or break ties
 * here, so marking a fragrance as a signature scent never biases it toward
 * being recommended more often.
 *
 * vibe is checked right after total (before weatherSeason/formality) since
 * it's now the single heaviest-weighted dimension (section 27) — the
 * canonical ranking should agree with "which fragrance actually reads as
 * the right aesthetic for this outfit" before falling back to secondary
 * weather/formality fit.
 *
 * This ordering is still the canonical "best fit first" ranking used by
 * variety mode below (section 33) to build its qualifying pool — variety
 * mode's randomness is scoped entirely to *which* member of that pool gets
 * picked, never to how the pool itself is ranked or bounded.
 */
function compareCandidates(a: ScoredFragrance, b: ScoredFragrance): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.vibe !== b.vibe) return b.vibe - a.vibe;
  if (a.weatherSeason !== b.weatherSeason) return b.weatherSeason - a.weatherSeason;
  if (a.formality !== b.formality) return b.formality - a.formality;
  const nameA = `${a.owned.fragrance.brand} ${a.owned.fragrance.name}`;
  const nameB = `${b.owned.fragrance.brand} ${b.owned.fragrance.name}`;
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  return a.owned.fragrance.id < b.owned.fragrance.id ? -1 : 1;
}

// ── Reason string (section 30) — deterministic, no LLM ───────────────────────

const VIBE_LABELS: Record<FragranceVibe, string> = {
  FRESH_CLEAN: 'fresh, clean',
  WARM_COZY: 'warm, cozy',
  DARK_SEDUCTIVE: 'dark, seductive',
  WOODY_EARTHY: 'earthy, woody',
  GOURMAND_SWEET: 'sweet, indulgent',
  AROMATIC_SPORTY: 'aromatic, sporty',
  FLORAL_ROMANTIC: 'romantic, floral',
  SPICY_CONFIDENT: 'bold, confident',
};

function pickKeyAccords(fragrance: ScorableFragrance): string[] {
  if (!fragrance.mainAccords?.length) return [];
  return [...fragrance.mainAccords].sort((a, b) => b.weight - a.weight).slice(0, 3).map((a) => a.name);
}

function buildReason(scored: ScoredFragrance, context: RecommendationContext): string {
  const accords = pickKeyAccords(scored.owned.fragrance);
  const accordPhrase = accords.length > 0 ? accords.slice(0, 2).join(' and ') : 'its character';

  // A genuine vibe match (not just the highest-scoring dimension) gets its
  // own, most-specific sentence — vibe is the dominant signal, so lead with
  // it whenever there's a real match to name rather than a generic fallback.
  if (context.outfitVibe && scored.owned.fragrance.primaryVibe === context.outfitVibe) {
    return `Its ${accordPhrase} profile matches this look's ${VIBE_LABELS[context.outfitVibe]} character.`;
  }
  if (context.outfitVibe && scored.owned.fragrance.secondaryVibes?.includes(context.outfitVibe)) {
    return `Its ${accordPhrase} profile leans into this look's ${VIBE_LABELS[context.outfitVibe]} side.`;
  }

  // Otherwise lead with whichever remaining dimension contributed most.
  const dims: { key: 'weather' | 'formality'; value: number }[] = [
    { key: 'weather', value: scored.weatherSeason },
    { key: 'formality', value: scored.formality },
  ];
  const leading = dims.sort((a, b) => b.value - a.value)[0]!.key;

  if (leading === 'formality' && scored.formality >= 16) {
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

/**
 * Score-weighted random pick, blended toward uniform as varietyLevel rises.
 *
 * A pool member's raw score gap over its weakest pool-mate can be large
 * (e.g. one fully AI-profiled fragrance vs. several manually-added ones
 * sitting at flat neutral defaults) — a *constant* score-linear weighting
 * would let that one fragrance dominate nearly every independent draw
 * regardless of how wide pickQualifyingPool made the band, which is
 * indistinguishable from "variety does nothing" in practice even though
 * a different pick was technically always possible. Blending the weights
 * toward uniform as varietyLevel approaches 100 makes the slider's high
 * end mean what it says: real, visibly-rotating variety among the
 * qualifying pool, not just a low-probability tail event.
 */
function weightedPick(pool: ScoredFragrance[], varietyLevel: number, random: () => number): ScoredFragrance {
  if (pool.length === 1) return pool[0]!;
  // Shift weights so the lowest-scoring pool member still has some (small,
  // non-zero) chance — a raw `total` weight would starve anything near 0.
  const floor = Math.min(...pool.map((s) => s.total));
  const scoreWeights = pool.map((s) => s.total - floor + 1);
  const scoreTotal = scoreWeights.reduce((sum, w) => sum + w, 0);
  const uniformWeight = scoreTotal / pool.length;
  const uniformity = Math.max(0, Math.min(100, varietyLevel)) / 100;
  const weights = scoreWeights.map((w) => (1 - uniformity) * w + uniformity * uniformWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function toRecommendation(scored: ScoredFragrance, context: RecommendationContext): FragranceRecommendation {
  return {
    userFragranceId: scored.owned.userFragranceId,
    fragranceId: scored.owned.fragrance.id,
    brand: scored.owned.fragrance.brand,
    name: scored.owned.fragrance.name,
    concentration: scored.owned.fragrance.concentration,
    keyAccords: pickKeyAccords(scored.owned.fragrance),
    primaryVibe: scored.owned.fragrance.primaryVibe,
    reason: buildReason(scored, context),
  };
}

// ── Entry point ────────────────────────────────────────────────────────────────

const DEFAULT_RECOMMENDATION_COUNT = 3;

/**
 * Pure, synchronous. Candidates are ALWAYS restricted to ownedFragrances as
 * passed in by the caller — this function never queries anything itself, so
 * an unowned fragrance can never be recommended as long as the caller only
 * passes the authenticated user's own owned fragrances (see
 * fragrance-recommendation-integration — the caller-side contract).
 *
 * Returns up to `count` (default 3) DISTINCT fragrances, ranked best-first —
 * fewer only when the closet doesn't have that many eligible fragrances to
 * draw from, never by padding or repeating. Each slot is its own draw
 * without replacement: pickQualifyingPool + weightedPick run again against
 * whatever's left after the previous slot's pick is removed, so slot 2 and
 * 3 still respect the same best-fit/variety balance as slot 1 rather than
 * just being "the rest of the ranked list" — at varietyLevel 0 that
 * collapses to exactly the top-3 ranked list (deterministic, no `random`
 * calls at all); above 0 each slot is an independent weighted draw.
 */
export function recommendFragrances(input: {
  ownedFragrances: OwnedFragrance[];
  context: RecommendationContext;
  random?: () => number;
  count?: number;
}): FragranceRecommendation[] {
  const eligible = input.ownedFragrances.filter(isEligible);
  if (eligible.length === 0) return [];

  const varietyLevel = input.context.varietyLevel ?? 0;
  const random = input.random ?? Math.random;
  const count = Math.max(1, input.count ?? DEFAULT_RECOMMENDATION_COUNT);

  let remaining = eligible.map((owned) => scoreOne(owned, input.context)).sort(compareCandidates);
  const picks: ScoredFragrance[] = [];

  while (picks.length < count && remaining.length > 0) {
    const pool = pickQualifyingPool(remaining, varietyLevel);
    const winner = weightedPick(pool, varietyLevel, random);
    picks.push(winner);
    remaining = remaining.filter((s) => s !== winner);
  }

  return picks.map((scored) => toRecommendation(scored, input.context));
}
