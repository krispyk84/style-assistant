import { loadScoringConfig, getScoreBand } from './scoring-config.js';
import { scoreEssentialsCoverage } from './essentials-coverage.service.js';
import { scoreVersatilityFunctionality } from './versatility-functionality.service.js';
import { trendRelevanceService } from './trend-relevance.service.js';
import type {
  ScoringClosetItem,
  WardrobeScore,
  DimensionContribution,
} from './wardrobe-score.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a human-readable summary from the computed scores.
 */
function buildSummary(
  compositeScore: number,
  scoreBand: string,
  essentialsScore: number,
  versatilityScore: number,
  trendScore: number | null,
  gapCallouts: string[],
): string {
  const parts: string[] = [];

  if (compositeScore >= 80) {
    parts.push(`Your wardrobe scores ${compositeScore}/100 — a ${scoreBand.toLowerCase()} result.`);
  } else {
    parts.push(`Your wardrobe scores ${compositeScore}/100 (${scoreBand.toLowerCase()}).`);
  }

  if (essentialsScore >= 75) {
    parts.push('Your essentials coverage is strong.');
  } else {
    const gap = gapCallouts.find((c) => c.toLowerCase().startsWith('missing'));
    parts.push(gap ? `Key gap: ${gap.toLowerCase()}.` : 'There are some essentials gaps worth addressing.');
  }

  if (versatilityScore >= 70) {
    parts.push('Your wardrobe covers multiple occasions well.');
  } else if (versatilityScore < 50) {
    parts.push('Versatility could be improved — consider building out more occasion coverage.');
  }

  if (trendScore !== null) {
    if (trendScore >= 70) {
      parts.push('Your pieces align well with your uploaded style direction.');
    } else if (trendScore < 50) {
      parts.push('Several pieces may need refreshing relative to your style guide direction.');
    }
  } else {
    parts.push('Upload a style guide to unlock trend relevance scoring.');
  }

  return parts.join(' ');
}

/**
 * Deduplicate and prioritize gap callouts — tier-1 essentials first, then versatility, then trend.
 * Cap at 6 total to avoid overloading the UI.
 */
function aggregateGapCallouts(
  essentialsGaps: string[],
  versatilityGaps: string[],
  trendGaps: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const gap of [...essentialsGaps, ...versatilityGaps, ...trendGaps]) {
    const normalized = gap.trim().toLowerCase();
    if (!seen.has(normalized) && result.length < 6) {
      seen.add(normalized);
      result.push(gap);
    }
  }

  return result;
}

function aggregateStrengths(
  essentialsStrengths: string[],
  versatilityStrengths: string[],
  trendStrengths: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const s of [...essentialsStrengths, ...versatilityStrengths, ...trendStrengths]) {
    const normalized = s.trim().toLowerCase();
    if (!seen.has(normalized) && result.length < 4) {
      seen.add(normalized);
      result.push(s);
    }
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ComputeScoreOptions = {
  supabaseUserId: string;
  forceTrendRefresh?: boolean;
};

export async function computeWardrobeScore(
  items: ScoringClosetItem[],
  options: ComputeScoreOptions,
): Promise<WardrobeScore> {
  const config = loadScoringConfig();
  const { dimensionWeights: dw } = config;

  // Run pure-logic dimensions synchronously, trend async
  const essentials = scoreEssentialsCoverage(items, config);
  const versatility = scoreVersatilityFunctionality(items, config);
  const trend = await trendRelevanceService.scoreTrendRelevance(
    items,
    options.supabaseUserId,
    options.forceTrendRefresh ?? false,
  );

  // Trend score: if null (fallback), use a neutral 50 for composite calculation
  // but flag it clearly in the response
  const trendScoreForComposite = trend.score ?? 50;

  // Composite score: weighted average
  const rawComposite =
    essentials.score * dw.essentialsCoverage +
    versatility.score * dw.versatilityFunctionality +
    trendScoreForComposite * dw.trendRelevance;

  const compositeScore = Math.min(100, Math.max(0, Math.round(rawComposite)));

  // If trend is fallback, apply a small penalty to reflect the unknown
  const adjustedComposite = trend.hasFallback
    ? Math.round(compositeScore * 0.95) // 5% penalty for missing trend context
    : compositeScore;

  const band = getScoreBand(adjustedComposite, config);

  // Dimension contributions
  const essentialsContribution: DimensionContribution = {
    rawScore: essentials.score,
    weight: dw.essentialsCoverage,
    weightedContribution: Math.round(essentials.score * dw.essentialsCoverage),
  };

  const versatilityContribution: DimensionContribution = {
    rawScore: versatility.score,
    weight: dw.versatilityFunctionality,
    weightedContribution: Math.round(versatility.score * dw.versatilityFunctionality),
  };

  const trendContribution: DimensionContribution = {
    rawScore: trend.score ?? 0,
    weight: dw.trendRelevance,
    weightedContribution: Math.round(trendScoreForComposite * dw.trendRelevance),
  };

  // Aggregated callouts and strengths
  const gapCallouts = aggregateGapCallouts(
    essentials.gapCallouts,
    versatility.gapCallouts,
    trend.gapCallouts,
  );

  const strengthHighlights = aggregateStrengths(
    essentials.strengthHighlights,
    versatility.strengthHighlights,
    trend.strengthHighlights,
  );

  const summary = buildSummary(
    adjustedComposite,
    band.label,
    essentials.score,
    versatility.score,
    trend.score,
    gapCallouts,
  );

  return {
    compositeScore: adjustedComposite,
    scoreBand: band.label,
    scoreBandDescription: band.description,
    dimensions: {
      essentialsCoverage: essentials,
      versatilityFunctionality: versatility,
      trendRelevance: trend,
    },
    contributions: {
      essentialsCoverage: essentialsContribution,
      versatilityFunctionality: versatilityContribution,
      trendRelevance: trendContribution,
    },
    gapCallouts,
    strengthHighlights,
    trendAnnotations: trend.annotations,
    summary,
    metadata: {
      scoringVersion: config.scoringVersion,
      generatedAt: new Date().toISOString(),
      closetItemCount: items.length,
      styleGuidesUsed: !trend.hasFallback,
      fallbackFlags: {
        trendRelevance: trend.hasFallback,
      },
    },
  };
}
