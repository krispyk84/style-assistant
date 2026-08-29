import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { geminiTextClient } from '../../ai/gemini-text-client.js';
import { buildHaircutTrendsInstructions, buildHaircutTrendsUserPrompt } from '../../ai/prompts/haircut-trends.prompts.js';
import { getFashionSeason, type Hemisphere } from '../seasonal-trends/season-math.js';
import { haircutTrendsRepository } from './haircut-trends.repository.js';
import { HAIRCUT_TRENDS_GEMINI_SCHEMA, haircutTrendProfileResponseSchema } from './haircut-trends.schemas.js';

type EnsureInput = {
  hemisphere: Hemisphere;
  region?: string;
};

// One centralized dedup point: if several requests call ensure() for the
// same (season, year, hemisphere) while a generation is already in flight,
// they all no-op against the same in-progress attempt instead of firing
// duplicate Gemini requests. Cleared once the in-flight attempt settles.
const inFlightGenerations = new Map<string, Promise<void>>();

function keyFor(season: string, year: number, hemisphere: Hemisphere) {
  return `${season}:${year}:${hemisphere}`;
}

async function generateAndPersist(params: { season: string; year: number; hemisphere: Hemisphere; region?: string }) {
  const regionOrLocation = params.region?.trim() || 'Unknown — assume mainstream North America';

  try {
    const raw = await geminiTextClient.generateStructuredContent({
      instructions: buildHaircutTrendsInstructions(),
      userPrompt: buildHaircutTrendsUserPrompt({ season: params.season, year: params.year, regionOrLocation }),
      responseSchema: HAIRCUT_TRENDS_GEMINI_SCHEMA,
      logKey: `haircut-trends:${params.season}:${params.year}`,
    });

    const parsed = haircutTrendProfileResponseSchema.safeParse(raw);

    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => issue.message).join('; ').slice(0, 500);
      logger.error(
        { season: params.season, year: params.year, reason },
        'Haircut trends: Gemini response failed validation — keeping any existing valid profile'
      );
      await haircutTrendsRepository.createInvalid(
        { season: params.season, year: params.year, hemisphere: params.hemisphere },
        params.region ?? null,
        reason,
        raw,
      );
      return;
    }

    await haircutTrendsRepository.createValid(
      { season: params.season, year: params.year, hemisphere: params.hemisphere },
      params.region ?? null,
      parsed.data,
    );

    logger.info({ season: params.season, year: params.year }, 'Haircut trends: new profile generated and persisted');
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error(
      { season: params.season, year: params.year, errorCode: code, message, error },
      'Haircut trends: generation failed — the app continues on its existing/stale profile or the fixed curated list'
    );
  }
}

export const haircutTrendsService = {
  /** Pure DB read — never calls Gemini. */
  async getCurrentTrendProfile(hemisphere: Hemisphere) {
    const { season, year } = getFashionSeason(new Date(), hemisphere);
    const current = await haircutTrendsRepository.findCurrent({ season, year, hemisphere });
    if (current) {
      return { profile: current, isStale: false as const };
    }

    const stale = await haircutTrendsRepository.findMostRecentValid(hemisphere);
    if (stale) {
      return { profile: stale, isStale: true as const };
    }

    return null;
  },

  /**
   * The one entry point that can trigger a Gemini call. Safe to call from
   * multiple concurrent requests — dedupes in-flight generations per
   * (season, year, hemisphere) key, and never blocks the caller.
   */
  ensureCurrentProfile(input: EnsureInput): void {
    const { season, year } = getFashionSeason(new Date(), input.hemisphere);
    const key = keyFor(season, year, input.hemisphere);

    // Must be synchronous and precede any `await` — see seasonal-trends.service.ts
    // for the full race-condition rationale (two concurrent callers must not
    // both pass this check before either sets the map entry).
    if (inFlightGenerations.has(key)) return;

    const generation = (async () => {
      try {
        const existing = await haircutTrendsRepository.findCurrent({ season, year, hemisphere: input.hemisphere });
        if (existing) return;

        await generateAndPersist({ season, year, hemisphere: input.hemisphere, region: input.region });
      } catch (error) {
        logger.error({ error, key }, 'Haircut trends: ensureCurrentProfile background check failed');
      } finally {
        inFlightGenerations.delete(key);
      }
    })();

    inFlightGenerations.set(key, generation);
  },

  /** Debug/manual refresh — same dedup guard, but skips the "already have one" check. */
  forceRefresh(input: EnsureInput): void {
    const { season, year } = getFashionSeason(new Date(), input.hemisphere);
    const key = keyFor(season, year, input.hemisphere);

    if (inFlightGenerations.has(key)) return;

    const generation = generateAndPersist({ season, year, hemisphere: input.hemisphere, region: input.region }).finally(() => {
      inFlightGenerations.delete(key);
    });

    inFlightGenerations.set(key, generation);
  },
};
