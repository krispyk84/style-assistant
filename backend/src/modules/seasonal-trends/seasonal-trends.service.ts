import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { geminiTextClient } from '../../ai/gemini-text-client.js';
import { buildSeasonalTrendsInstructions, buildSeasonalTrendsUserPrompt } from '../../ai/prompts/seasonal-trends.prompts.js';
import { scoreTrend } from '../../ai/prompts/seasonal-trend-guidance.js';
import { getFashionSeason, type Hemisphere } from './season-math.js';
import { seasonalTrendsRepository, type FashionGender } from './seasonal-trends.repository.js';
import { SEASONAL_TRENDS_GEMINI_SCHEMA, seasonalTrendProfileResponseSchema, type FashionTrend } from './seasonal-trends.schemas.js';
import { trendFeedbackService } from './trend-feedback.service.js';
import { trendSketchRepository } from './trend-sketch.repository.js';
import { trendSketchService } from './trend-sketch.service.js';

const TREND_REPORT_COUNT = 20;
type TrendReportFormality = 'business' | 'smart-casual' | 'casual';
const FORMALITY_SORT_ORDER: Record<TrendReportFormality, number> = { business: 0, 'smart-casual': 1, casual: 2 };

export type TrendReportEntry = {
  name: string;
  summary: string;
  formality: TrendReportFormality;
  lifecycle: FashionTrend['lifecycle'];
  garmentCategories: string[];
  silhouettes: string[];
  colours: string[];
  materialsOrTextures: string[];
  footwear: string[];
  accessories: string[];
};

// Flattens the three formality-specific lists (30 trends total) into a single
// ranked top-20 for the human-facing "Fashion Trend Report" — reuses the same
// scoring weights that already drive prompt injection, so the report reflects
// the exact same notion of "top" the stylist itself is using, not a separate
// ad-hoc ranking. Dedupes by name in case the same concept was named
// identically across formality tiers. Selection is by score; the caller sorts
// the returned array for display (e.g. grouped by formality).
function buildTrendReport(
  profile: { business: unknown; smartCasual: unknown; casual: unknown },
  isStale: boolean,
): TrendReportEntry[] {
  const tagged: { trend: FashionTrend; formality: TrendReportFormality }[] = [
    ...((profile.business as FashionTrend[] | undefined) ?? []).map((trend) => ({ trend, formality: 'business' as const })),
    ...((profile.smartCasual as FashionTrend[] | undefined) ?? []).map((trend) => ({ trend, formality: 'smart-casual' as const })),
    ...((profile.casual as FashionTrend[] | undefined) ?? []).map((trend) => ({ trend, formality: 'casual' as const })),
  ];

  const seenNames = new Set<string>();
  const deduped = tagged.filter(({ trend }) => {
    const key = trend.name.trim().toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  return deduped
    .map((entry) => ({ ...entry, score: scoreTrend(entry.trend, isStale) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TREND_REPORT_COUNT)
    .map(({ trend, formality }) => ({
      name: trend.name,
      summary: trend.summary,
      formality,
      lifecycle: trend.lifecycle,
      garmentCategories: trend.garmentCategories,
      silhouettes: trend.silhouettes,
      colours: trend.colours,
      materialsOrTextures: trend.materialsOrTextures,
      footwear: trend.footwear,
      accessories: trend.accessories,
    }));
}

type EnsureInput = {
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
  region?: string;
};

// One centralized dedup point: if several views/launches call ensure() for the
// same (season, year, fashionGender, hemisphere) while a generation is already
// in flight, they all await that SAME promise instead of firing duplicate
// Gemini requests. Cleared once the in-flight attempt settles either way.
const inFlightGenerations = new Map<string, Promise<void>>();

function keyFor(season: string, year: number, fashionGender: FashionGender, hemisphere: Hemisphere) {
  return `${season}:${year}:${fashionGender}:${hemisphere}`;
}

async function generateAndPersist(params: {
  season: string;
  year: number;
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
  region?: string;
}) {
  const regionOrLocation = params.region?.trim() || 'Unknown — assume mainstream North America';

  try {
    const raw = await geminiTextClient.generateStructuredContent({
      instructions: buildSeasonalTrendsInstructions(),
      userPrompt: buildSeasonalTrendsUserPrompt({
        season: params.season as never,
        year: params.year,
        fashionGender: params.fashionGender,
        regionOrLocation,
      }),
      responseSchema: SEASONAL_TRENDS_GEMINI_SCHEMA,
      logKey: `seasonal-trends:${params.fashionGender}:${params.season}:${params.year}`,
    });

    const parsed = seasonalTrendProfileResponseSchema.safeParse(raw);

    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => issue.message).join('; ').slice(0, 500);
      logger.error(
        { fashionGender: params.fashionGender, season: params.season, year: params.year, reason },
        'Seasonal trends: Gemini response failed validation — keeping any existing valid profile'
      );
      await seasonalTrendsRepository.createInvalid(
        { season: params.season, year: params.year, fashionGender: params.fashionGender, hemisphere: params.hemisphere },
        params.region ?? null,
        reason,
        raw,
      );
      return;
    }

    await seasonalTrendsRepository.createValid(
      { season: params.season, year: params.year, fashionGender: params.fashionGender, hemisphere: params.hemisphere },
      params.region ?? null,
      parsed.data,
    );

    logger.info(
      { fashionGender: params.fashionGender, season: params.season, year: params.year },
      'Seasonal trends: new profile generated and persisted'
    );

    // Tied to profile generation (once per season), not report views — a
    // trend that recurs next season reuses its sketch via ensureSketchesForFreshProfile's
    // name-based matching rather than regenerating.
    trendSketchService.ensureSketchesForFreshProfile(
      params.fashionGender,
      buildTrendReport(parsed.data, false),
    );
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error(
      { fashionGender: params.fashionGender, season: params.season, year: params.year, errorCode: code, message, error },
      'Seasonal trends: generation failed — the app continues on its existing/stale profile or plain styling rules'
    );
  }
}

export const seasonalTrendsService = {
  /**
   * Pure DB read — never calls Gemini. Used internally by outfit generation
   * at prompt-build time, so it must always be fast and non-blocking. Falls
   * back to the most recent valid profile for this fashionGender+hemisphere
   * (any season/year) if the current season has no profile yet — a stale
   * profile is preferable to no trend intelligence at all.
   */
  async getCurrentTrendProfile(fashionGender: FashionGender, hemisphere: Hemisphere) {
    const { season, year } = getFashionSeason(new Date(), hemisphere);
    const current = await seasonalTrendsRepository.findCurrent({ season, year, fashionGender, hemisphere });
    if (current) {
      return { profile: current, isStale: false as const };
    }

    const stale = await seasonalTrendsRepository.findMostRecentValid(fashionGender, hemisphere);
    if (stale) {
      return { profile: stale, isStale: true as const };
    }

    return null;
  },

  /**
   * Human-facing "Fashion Trend Report" — the same three formality-specific
   * lists flattened, deduped, and ranked into a single top-20, using the
   * exact scoring weights already driving prompt injection. Sorted by
   * formality (business, then smart casual, then casual) for display, rank
   * preserved within each group. Attaches each trend's persisted sketch
   * status/url via a pure read (generation itself is kicked off separately,
   * tied to profile creation — see generateAndPersist).
   */
  async getTrendReport(fashionGender: FashionGender, hemisphere: Hemisphere, supabaseUserId: string) {
    const result = await seasonalTrendsService.getCurrentTrendProfile(fashionGender, hemisphere);
    if (!result) return null;

    const trends = buildTrendReport(result.profile, result.isStale)
      .sort((a, b) => FORMALITY_SORT_ORDER[a.formality] - FORMALITY_SORT_ORDER[b.formality]);

    const [sketchByName, feedbackMap] = await Promise.all([
      trendSketchService.getSketchStatuses(fashionGender, trends.map((t) => t.name)),
      trendFeedbackService.getFeedbackMap(supabaseUserId, fashionGender),
    ]);

    return {
      trends: trends.map((trend) => ({
        ...trend,
        sketchStatus: sketchByName.get(trend.name)?.sketchStatus ?? null,
        sketchImageUrl: sketchByName.get(trend.name)?.sketchImageUrl ?? null,
        userFeedback: feedbackMap.get(trendSketchRepository.normalizeTrendKey(trend.name)) ?? null,
      })),
      isStale: result.isStale,
      generatedAt: result.profile.generatedAt,
    };
  },

  /**
   * The one entry point that can trigger a Gemini call. Safe to call from
   * multiple concurrent app-launch requests — dedupes in-flight generations
   * per (season, year, fashionGender, hemisphere) key, and never blocks the
   * caller: it kicks off generation in the background (when needed) and
   * returns immediately either way.
   */
  ensureCurrentProfile(input: EnsureInput): void {
    const { season, year } = getFashionSeason(new Date(), input.hemisphere);
    const key = keyFor(season, year, input.fashionGender, input.hemisphere);

    // Must be synchronous and precede any `await` — two concurrent callers
    // for the same key each run this synchronous prefix atomically (Node
    // never interleaves two call stacks mid-statement), so whichever runs
    // first wins the map entry and the second sees inFlightGenerations.has()
    // already true. If the check and the set were split across an `await`,
    // both could pass the check before either had set the entry.
    if (inFlightGenerations.has(key)) return;

    const generation = (async () => {
      try {
        const existing = await seasonalTrendsRepository.findCurrent({
          season, year, fashionGender: input.fashionGender, hemisphere: input.hemisphere,
        });
        if (existing) return; // already have a current, valid profile — nothing to do

        await generateAndPersist({
          season, year, fashionGender: input.fashionGender, hemisphere: input.hemisphere, region: input.region,
        });
      } catch (error) {
        logger.error({ error, key }, 'Seasonal trends: ensureCurrentProfile background check failed');
      } finally {
        inFlightGenerations.delete(key);
      }
    })();

    inFlightGenerations.set(key, generation);
  },

  /** Debug/manual refresh — same dedup guard, but skips the "already have one" check. */
  forceRefresh(input: EnsureInput): void {
    const { season, year } = getFashionSeason(new Date(), input.hemisphere);
    const key = keyFor(season, year, input.fashionGender, input.hemisphere);

    if (inFlightGenerations.has(key)) return;

    const generation = generateAndPersist({
      season, year, fashionGender: input.fashionGender, hemisphere: input.hemisphere, region: input.region,
    }).finally(() => {
      inFlightGenerations.delete(key);
    });

    inFlightGenerations.set(key, generation);
  },
};
