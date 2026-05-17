// ─────────────────────────────────────────────────────────────────────────────
// Closet Fit Check — evaluates a candidate piece against the user's profile
// and existing closet, returning a structured report card across five
// weighted dimensions plus a verdict.
// ─────────────────────────────────────────────────────────────────────────────

export type ClosetFitCheckVerdict =
  | 'strong-buy'
  | 'worth-considering'
  | 'only-if-you-love-it'
  | 'skip';

export type ClosetFitCheckRequest = {
  uploadedImageId?: string;
  uploadedImageUrl: string;
  /** Optional user-supplied context, e.g. "found at Aritzia for $250". */
  notes?: string;
  /** 0–100 trendiness setting from the user's app settings. */
  trendiness?: number;
};

export type ClosetFitCheckScores = {
  /** 0–100. Is this piece current / cool / relevant right now? */
  trendiness: number;
  /** 0–100. Does it suit the user's profile, body, palette, aesthetic? */
  profileFit: number;
  /** 0–100. Higher = more complementary; lower = more redundant with what they own. */
  redundancyComplementarity: number;
  /** 0–100. Tasteful design judgment from the stylist perspective. */
  stylistOpinion: number;
  /** 0–100. How many outfits could they make? How well does it integrate? */
  utility: number;
};

export type ClosetFitCheckWeights = {
  trendiness: number;
  profileFit: number;
  redundancyComplementarity: number;
  stylistOpinion: number;
  utility: number;
};

export type ClosetFitCheckReasoning = {
  trendiness: string;
  profileFit: string;
  redundancyComplementarity: string;
  stylistOpinion: string;
  utility: string;
};

export type ClosetFitCheckItem = {
  title: string;
  category: string;
  primaryColor: string | null;
  colorFamily: string | null;
  material: string | null;
  formality: string | null;
};

export type ClosetFitCheckStylistTake = {
  /** Sharp, precise, European voice — construction, silhouette, quiet authority. */
  vittorio: string;
  /** Culturally fluent, warm, socially confident — energy, occasion, expression. */
  alessandra: string;
};

export type ClosetFitCheckResponse = {
  item: ClosetFitCheckItem;
  scores: ClosetFitCheckScores;
  weights: ClosetFitCheckWeights;
  /** Deterministic weighted sum of scores (0–100, integer). */
  overallScore: number;
  verdict: ClosetFitCheckVerdict;
  /** Direct 1–2 sentence verdict line. */
  summary: string;
  reasoning: ClosetFitCheckReasoning;
  /** Paragraph describing how this piece fits into / collides with their existing closet. */
  closetImpact: string;
  /** Two stylist perspectives — same piece, two voices. May agree or disagree. */
  stylistTake: ClosetFitCheckStylistTake;
  /** IDs of closet items the candidate most overlaps with (may be empty). */
  similarClosetItemIds: string[];
  /** The uploaded image url that was evaluated, echoed back for the result screen. */
  imageUrl: string;
};

// ── Weights — single source of truth ─────────────────────────────────────────
// Profile fit + utility weighted highest per the product brief ("profile fit
// and utility should probably matter more than pure trendiness"); redundancy
// can meaningfully drag the score down because low redundancy score = high
// overlap with what the user already owns.

export const CLOSET_FIT_CHECK_WEIGHTS: ClosetFitCheckWeights = {
  profileFit: 0.3,
  utility: 0.25,
  redundancyComplementarity: 0.2,
  stylistOpinion: 0.15,
  trendiness: 0.1,
};

export function computeOverallScore(scores: ClosetFitCheckScores, weights = CLOSET_FIT_CHECK_WEIGHTS): number {
  const raw =
    scores.trendiness * weights.trendiness +
    scores.profileFit * weights.profileFit +
    scores.redundancyComplementarity * weights.redundancyComplementarity +
    scores.stylistOpinion * weights.stylistOpinion +
    scores.utility * weights.utility;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// Verdict bands — calibrated so the score distribution we expect from the
// prompt maps to actionable buckets. A well-chosen piece that fits the user
// should clear 60+ ("Worth considering"); 75+ should feel like a clear yes.
// Items below 45 are the ones that genuinely shouldn't be bought.
export function verdictFromScore(overallScore: number): ClosetFitCheckVerdict {
  if (overallScore >= 75) return 'strong-buy';
  if (overallScore >= 60) return 'worth-considering';
  if (overallScore >= 45) return 'only-if-you-love-it';
  return 'skip';
}
