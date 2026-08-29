import type { FashionTrend } from '../../modules/seasonal-trends/seasonal-trends.schemas.js';

// Central trend-weighting configuration — the ONE place that governs how
// strongly seasonal trends influence outfit generation, rather than scoring
// numbers scattered across prompt files. There is no separate deterministic
// ranking step in this codebase (outfit generation is a single LLM call, not
// candidates scored by a formula) — trend influence is expressed as prompt
// guidance whose selection and phrasing are driven by this config, which is
// the correct analogue of "weighting" in a prompt-based architecture.
export const TREND_WEIGHT_CONFIG = {
  /** How many of the 10 ranked trends per formality actually reach the prompt — keeps the signal focused on the strongest few instead of diluting it across all 10. */
  topTrendCount: 5,
  /** Multiplier applied to a trend's score when the profile is stale (last season, not this one) — still useful, but less current than a same-season profile. */
  staleProfileDamping: 0.7,
  /** Multiplier applied to a "declining" trend's score — per spec, declining trends modestly reduce preference, never a hard penalty. */
  decliningLifecycleDamping: 0.5,
} as const;

type Formality = 'business' | 'smart-casual' | 'casual';

function trendListKeyFor(formality: Formality): 'business' | 'smartCasual' | 'casual' {
  if (formality === 'business') return 'business';
  if (formality === 'smart-casual') return 'smartCasual';
  return 'casual';
}

// trend relevance (rank, implicit in the score below) × trend strength ×
// confidence × versatility × lifecycle damping — formality match and
// garment/category relevance are handled upstream by (a) selecting the
// formality-specific list in the first place, and (b) the per-slot
// applicability guidance included in the returned text (only apply a
// footwear trend to footwear, etc).
export function scoreTrend(trend: FashionTrend, isStale: boolean): number {
  let score = trend.trendStrength * trend.confidence * (trend.versatility / 10);
  if (isStale) score *= TREND_WEIGHT_CONFIG.staleProfileDamping;
  if (trend.lifecycle === 'declining') score *= TREND_WEIGHT_CONFIG.decliningLifecycleDamping;
  return score;
}

function formatTrendLine(trend: FashionTrend): string {
  const rules = trend.stylingRules.slice(0, 2).join(' ');
  const avoid = trend.avoid.length ? ` Avoid: ${trend.avoid.slice(0, 2).join('; ')}.` : '';
  const lifecycleNote = trend.lifecycle === 'declining' ? ' (declining — use sparingly, do not force it out)' : '';
  return `- ${trend.name}${lifecycleNote}: ${rules}${avoid}`;
}

/**
 * Builds the seasonal-trend guidance block for one formality tier, or null
 * if no trend profile is available (missing/disabled) — callers should treat
 * null as "omit this section entirely", never as a reason to fail generation.
 */
export function buildSeasonalTrendGuidance(input: {
  profile: { business: unknown; smartCasual: unknown; casual: unknown } | null;
  formality: Formality;
  isStale: boolean;
}): string | null {
  if (!input.profile) return null;

  const key = trendListKeyFor(input.formality);
  const trends = input.profile[key] as FashionTrend[] | undefined;
  if (!Array.isArray(trends) || trends.length === 0) return null;

  const ranked = [...trends]
    .map((trend) => ({ trend, score: scoreTrend(trend, input.isStale) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TREND_WEIGHT_CONFIG.topTrendCount);

  const lines = ranked.map(({ trend }) => formatTrendLine(trend));

  return [
    `Current seasonal fashion trends${input.isStale ? ' (from last season — treat as a softer signal, still broadly relevant)' : ''}:`,
    'These are a soft styling bias, not a requirement — never reject a good, appropriate outfit just because it does not lean into a trend, and never suggest the wearer replace wardrobe items solely because something is no longer trending.',
    'Before applying any one line below, check it actually relates to the piece/decision at hand (a footwear trend should influence footwear, a colour trend should influence colour choices, etc.) — do not force an unrelated trend onto a slot it has nothing to do with.',
    'When multiple otherwise-suitable options exist, mildly prefer the one that aligns with these:',
    ...lines,
  ].join('\n');
}
