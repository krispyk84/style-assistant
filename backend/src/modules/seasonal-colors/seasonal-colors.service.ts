import { logger } from '../../config/logger.js';
import { describeError } from '../../lib/http-error.js';
import { geminiTextClient } from '../../ai/gemini-text-client.js';
import { buildSeasonalColorsInstructions, buildSeasonalColorsUserPrompt } from '../../ai/prompts/seasonal-colors.prompts.js';
import { profileRepository } from '../profile/profile.repository.js';
import { getFashionSeason, type Hemisphere } from '../seasonal-trends/season-math.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import { colorFeedbackService } from './color-feedback.service.js';
import { colorSwatchSketchRepository } from './color-swatch-sketch.repository.js';
import { colorSwatchSketchService } from './color-swatch-sketch.service.js';
import { seasonalColorsRepository } from './seasonal-colors.repository.js';
import { SEASONAL_COLORS_GEMINI_SCHEMA, seasonalColorPaletteResponseSchema, type SeasonalColor } from './seasonal-colors.schemas.js';

type EnsureInput = {
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
  region?: string;
};

// One centralized dedup point — mirrors seasonal-trends.service.ts exactly.
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
      instructions: buildSeasonalColorsInstructions(params.fashionGender),
      userPrompt: buildSeasonalColorsUserPrompt({
        season: params.season as never,
        year: params.year,
        fashionGender: params.fashionGender,
        regionOrLocation,
      }),
      responseSchema: SEASONAL_COLORS_GEMINI_SCHEMA,
      logKey: `seasonal-colors:${params.fashionGender}:${params.season}:${params.year}`,
    });

    const parsed = seasonalColorPaletteResponseSchema.safeParse(raw);

    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => issue.message).join('; ').slice(0, 500);
      logger.error(
        { fashionGender: params.fashionGender, season: params.season, year: params.year, reason },
        'Seasonal colors: Gemini response failed validation — keeping any existing valid palette'
      );
      await seasonalColorsRepository.createInvalid(
        { season: params.season, year: params.year, fashionGender: params.fashionGender, hemisphere: params.hemisphere },
        params.region ?? null,
        reason,
        raw,
      );
      return;
    }

    await seasonalColorsRepository.createValid(
      { season: params.season, year: params.year, fashionGender: params.fashionGender, hemisphere: params.hemisphere },
      params.region ?? null,
      parsed.data,
    );

    logger.info(
      { fashionGender: params.fashionGender, season: params.season, year: params.year },
      'Seasonal colors: new palette generated and persisted'
    );

    // Tied to palette generation (once per season), not report views — a
    // colour that recurs next season reuses its swatch via name-based matching.
    colorSwatchSketchService.ensureSketchesForFreshPalette(params.fashionGender, parsed.data.colors);
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error(
      { fashionGender: params.fashionGender, season: params.season, year: params.year, errorCode: code, message, error },
      'Seasonal colors: generation failed — the app continues on its existing/stale palette or no palette'
    );
  }
}

export const seasonalColorsService = {
  /** Pure DB read — never calls Gemini. */
  async getCurrentColorPalette(fashionGender: FashionGender, hemisphere: Hemisphere) {
    const { season, year } = getFashionSeason(new Date(), hemisphere);
    const current = await seasonalColorsRepository.findCurrent({ season, year, fashionGender, hemisphere });
    if (current) {
      return { palette: current, isStale: false as const };
    }

    const stale = await seasonalColorsRepository.findMostRecentValid(fashionGender, hemisphere);
    if (stale) {
      return { palette: stale, isStale: true as const };
    }

    return null;
  },

  /**
   * Human-facing colour list for the "Fashion Trend Report" — attaches each
   * colour's persisted swatch status/url via a pure read, plus a per-user
   * bestSuitedForUser flag computed from the requesting user's own
   * profile.skinTone against each colour's (shared, AI-generated)
   * bestSuitedSkinTones list. That per-user check is a cheap set-membership
   * lookup, not a generation — the colours themselves stay shared/global.
   */
  async getColorReport(fashionGender: FashionGender, hemisphere: Hemisphere, supabaseUserId: string) {
    const result = await seasonalColorsService.getCurrentColorPalette(fashionGender, hemisphere);
    if (!result) return null;

    const colors = (result.palette.colors as unknown as SeasonalColor[]).sort((a, b) => a.rank - b.rank);
    const [sketchByName, profile, feedbackMap] = await Promise.all([
      colorSwatchSketchService.getSketchStatuses(fashionGender, colors.map((c) => c.name)),
      profileRepository.findByUserId(supabaseUserId),
      colorFeedbackService.getFeedbackMap(supabaseUserId, fashionGender),
    ]);
    const userSkinTone = profile?.skinTone ?? null;

    return {
      colors: colors.map((color) => ({
        ...color,
        sketchStatus: sketchByName.get(color.name)?.sketchStatus ?? null,
        sketchImageUrl: sketchByName.get(color.name)?.sketchImageUrl ?? null,
        bestSuitedForUser: userSkinTone !== null && color.bestSuitedSkinTones.includes(userSkinTone as SeasonalColor['bestSuitedSkinTones'][number]),
        userFeedback: feedbackMap.get(colorSwatchSketchRepository.normalizeColorKey(color.name)) ?? null,
      })),
      isStale: result.isStale,
      generatedAt: result.palette.generatedAt,
    };
  },

  /**
   * The one entry point that can trigger a Gemini call. Safe to call from
   * multiple concurrent requests — dedupes in-flight generations per
   * (season, year, fashionGender, hemisphere) key, and never blocks the caller.
   */
  ensureCurrentProfile(input: EnsureInput): void {
    const { season, year } = getFashionSeason(new Date(), input.hemisphere);
    const key = keyFor(season, year, input.fashionGender, input.hemisphere);

    if (inFlightGenerations.has(key)) return;

    const generation = (async () => {
      try {
        const existing = await seasonalColorsRepository.findCurrent({
          season, year, fashionGender: input.fashionGender, hemisphere: input.hemisphere,
        });
        if (existing) return;

        await generateAndPersist({
          season, year, fashionGender: input.fashionGender, hemisphere: input.hemisphere, region: input.region,
        });
      } catch (error) {
        logger.error({ error, key }, 'Seasonal colors: ensureCurrentProfile background check failed');
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
