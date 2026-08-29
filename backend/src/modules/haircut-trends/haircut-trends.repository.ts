import { prisma } from '../../db/prisma.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import type { HaircutTrendProfileResponse } from './haircut-trends.schemas.js';

type ProfileKey = {
  season: string;
  year: number;
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
};

export const haircutTrendsRepository = {
  /** Exact (season, year, fashionGender, hemisphere) match, only if it passed validation. */
  async findCurrent(key: ProfileKey) {
    return prisma.haircutTrendProfile.findFirst({
      where: { ...key, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Most recent valid profile for this fashionGender+hemisphere regardless of season/year — the "stale is better than nothing" fallback. */
  async findMostRecentValid(fashionGender: FashionGender, hemisphere: Hemisphere) {
    return prisma.haircutTrendProfile.findFirst({
      where: { fashionGender, hemisphere, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Upsert, not create — (season, year, fashionGender, hemisphere) is unique
  // with no status in the key, so a plain create() throws P2002 the moment
  // *any* row (valid or invalid) already exists for this key, e.g. on a
  // manual/forced refresh of an already-current season.
  async createValid(key: ProfileKey, region: string | null, profile: HaircutTrendProfileResponse) {
    const parsedGeneratedAt = new Date(profile.generatedAt);
    const generatedAt = Number.isNaN(parsedGeneratedAt.getTime()) ? new Date() : parsedGeneratedAt;
    return prisma.haircutTrendProfile.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: { ...key, region, status: 'valid', styles: profile.styles, generatedAt },
      update: { region, status: 'valid', invalidReason: null, styles: profile.styles, generatedAt },
    });
  },

  async createInvalid(key: ProfileKey, region: string | null, reason: string, rawResponse: unknown) {
    // Never overwrite a valid profile with a bad one.
    const existing = await prisma.haircutTrendProfile.findUnique({ where: { season_year_fashionGender_hemisphere: key } });
    if (existing?.status === 'valid') return existing;

    const data = {
      region,
      status: 'invalid' as const,
      invalidReason: reason,
      // Preserve whatever shape came back (even garbage) for later inspection —
      // this row is NEVER returned by findCurrent/findMostRecentValid, so a bad
      // response can never clobber a good one.
      styles: safeStyles(rawResponse),
    };
    return prisma.haircutTrendProfile.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: { ...key, ...data },
      update: data,
    });
  },
};

function safeStyles(rawResponse: unknown): object {
  if (rawResponse && typeof rawResponse === 'object' && 'styles' in rawResponse) {
    return (rawResponse as Record<string, unknown>).styles as object;
  }
  return [];
}
