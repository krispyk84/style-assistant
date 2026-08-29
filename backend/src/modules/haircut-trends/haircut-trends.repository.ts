import { prisma } from '../../db/prisma.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import type { HaircutTrendProfileResponse } from './haircut-trends.schemas.js';

type ProfileKey = {
  season: string;
  year: number;
  hemisphere: Hemisphere;
};

export const haircutTrendsRepository = {
  /** Exact (season, year, hemisphere) match, only if it passed validation. */
  async findCurrent(key: ProfileKey) {
    return prisma.haircutTrendProfile.findFirst({
      where: { ...key, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Most recent valid profile for this hemisphere regardless of season/year — the "stale is better than nothing" fallback. */
  async findMostRecentValid(hemisphere: Hemisphere) {
    return prisma.haircutTrendProfile.findFirst({
      where: { hemisphere, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createValid(key: ProfileKey, region: string | null, profile: HaircutTrendProfileResponse) {
    const parsedGeneratedAt = new Date(profile.generatedAt);
    return prisma.haircutTrendProfile.create({
      data: {
        ...key,
        region,
        status: 'valid',
        styles: profile.styles,
        generatedAt: Number.isNaN(parsedGeneratedAt.getTime()) ? new Date() : parsedGeneratedAt,
      },
    });
  },

  async createInvalid(key: ProfileKey, region: string | null, reason: string, rawResponse: unknown) {
    return prisma.haircutTrendProfile.create({
      data: {
        ...key,
        region,
        status: 'invalid',
        invalidReason: reason,
        // Preserve whatever shape came back (even garbage) for later inspection —
        // this row is NEVER returned by findCurrent/findMostRecentValid, so a bad
        // response can never clobber a good one.
        styles: safeStyles(rawResponse),
      },
    });
  },
};

function safeStyles(rawResponse: unknown): object {
  if (rawResponse && typeof rawResponse === 'object' && 'styles' in rawResponse) {
    return (rawResponse as Record<string, unknown>).styles as object;
  }
  return [];
}
