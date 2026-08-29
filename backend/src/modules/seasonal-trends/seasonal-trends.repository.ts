import { prisma } from '../../db/prisma.js';
import type { Hemisphere } from './season-math.js';
import type { SeasonalTrendProfileResponse } from './seasonal-trends.schemas.js';

export type FashionGender = 'menswear' | 'womenswear';

type ProfileKey = {
  season: string;
  year: number;
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
};

export const seasonalTrendsRepository = {
  /** Exact (season, year, fashionGender, hemisphere) match, only if it passed validation. */
  async findCurrent(key: ProfileKey) {
    return prisma.seasonalTrendProfile.findFirst({
      where: { ...key, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Most recent valid profile for this fashionGender+hemisphere regardless of season/year — the "stale is better than nothing" fallback. */
  async findMostRecentValid(fashionGender: FashionGender, hemisphere: Hemisphere) {
    return prisma.seasonalTrendProfile.findFirst({
      where: { fashionGender, hemisphere, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Upsert, not create — (season, year, fashionGender, hemisphere) is unique
  // with no status in the key, so a plain create() throws P2002 the moment
  // *any* row (valid or invalid) already exists for this key. That includes
  // the ordinary case of a manual/forced refresh regenerating an already-
  // current season, which previously crashed generateAndPersist on every
  // attempt after the season's first successful generation.
  async createValid(key: ProfileKey, region: string | null, profile: SeasonalTrendProfileResponse) {
    const parsedGeneratedAt = new Date(profile.generatedAt);
    const generatedAt = Number.isNaN(parsedGeneratedAt.getTime()) ? new Date() : parsedGeneratedAt;
    return prisma.seasonalTrendProfile.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: {
        ...key,
        region,
        status: 'valid',
        business: profile.business,
        smartCasual: profile.smartCasual,
        casual: profile.casual,
        generatedAt,
      },
      update: {
        region,
        status: 'valid',
        invalidReason: null,
        business: profile.business,
        smartCasual: profile.smartCasual,
        casual: profile.casual,
        generatedAt,
      },
    });
  },

  async createInvalid(key: ProfileKey, region: string | null, reason: string, rawResponse: unknown) {
    // Never overwrite a valid profile with a bad one — a stale-but-valid
    // profile is preferable to Gemini's garbage response for this attempt.
    const existing = await prisma.seasonalTrendProfile.findUnique({ where: { season_year_fashionGender_hemisphere: key } });
    if (existing?.status === 'valid') return existing;

    const data = {
      region,
      status: 'invalid' as const,
      invalidReason: reason,
      // Preserve whatever shape came back (even garbage) for later inspection —
      // stored as-is in the same Json columns; findCurrent/findMostRecentValid
      // never return status:'invalid' rows, so this can never get served.
      business: safeJson(rawResponse, 'business'),
      smartCasual: safeJson(rawResponse, 'smartCasual'),
      casual: safeJson(rawResponse, 'casual'),
    };
    return prisma.seasonalTrendProfile.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: { ...key, ...data },
      update: data,
    });
  },
};

function safeJson(rawResponse: unknown, key: string) {
  if (rawResponse && typeof rawResponse === 'object' && key in rawResponse) {
    return (rawResponse as Record<string, unknown>)[key] as object;
  }
  return [];
}
