import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { geminiTextClient } from '../../ai/gemini-text-client.js';
import { buildSeasonalTrendsInstructions, buildSeasonalTrendsUserPrompt } from '../../ai/prompts/seasonal-trends.prompts.js';
import { getFashionSeason, type Hemisphere } from './season-math.js';
import { seasonalTrendsRepository, type FashionGender } from './seasonal-trends.repository.js';
import { SEASONAL_TRENDS_GEMINI_SCHEMA, seasonalTrendProfileResponseSchema } from './seasonal-trends.schemas.js';

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
