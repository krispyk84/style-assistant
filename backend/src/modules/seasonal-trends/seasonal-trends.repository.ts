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

  async createValid(key: ProfileKey, region: string | null, profile: SeasonalTrendProfileResponse) {
    const parsedGeneratedAt = new Date(profile.generatedAt);
    return prisma.seasonalTrendProfile.create({
      data: {
        ...key,
        region,
        status: 'valid',
        business: profile.business,
        smartCasual: profile.smartCasual,
        casual: profile.casual,
        generatedAt: Number.isNaN(parsedGeneratedAt.getTime()) ? new Date() : parsedGeneratedAt,
      },
    });
  },

  async createInvalid(key: ProfileKey, region: string | null, reason: string, rawResponse: unknown) {
    return prisma.seasonalTrendProfile.create({
      data: {
        ...key,
        region,
        status: 'invalid',
        invalidReason: reason,
        // Preserve whatever shape came back (even garbage) for later inspection —
        // stored as-is in the same Json columns; findCurrent/findMostRecentValid
        // never return status:'invalid' rows, so this can never get served.
        business: safeJson(rawResponse, 'business'),
        smartCasual: safeJson(rawResponse, 'smartCasual'),
        casual: safeJson(rawResponse, 'casual'),
      },
    });
  },
};

function safeJson(rawResponse: unknown, key: string) {
  if (rawResponse && typeof rawResponse === 'object' && key in rawResponse) {
    return (rawResponse as Record<string, unknown>)[key] as object;
  }
  return [];
}
