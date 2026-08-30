import { prisma } from '../../db/prisma.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import type { SeasonalColorPaletteResponse } from './seasonal-colors.schemas.js';

type PaletteKey = {
  season: string;
  year: number;
  fashionGender: FashionGender;
  hemisphere: Hemisphere;
};

export const seasonalColorsRepository = {
  /** Exact (season, year, fashionGender, hemisphere) match, only if it passed validation. */
  async findCurrent(key: PaletteKey) {
    return prisma.seasonalColorPalette.findFirst({
      where: { ...key, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Most recent valid palette for this fashionGender+hemisphere regardless of season/year — the "stale is better than nothing" fallback. */
  async findMostRecentValid(fashionGender: FashionGender, hemisphere: Hemisphere) {
    return prisma.seasonalColorPalette.findFirst({
      where: { fashionGender, hemisphere, status: 'valid' },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Upsert, not create — (season, year, fashionGender, hemisphere) is unique
  // with no status in the key, so a plain create() throws P2002 the moment
  // *any* row (valid or invalid) already exists for this key.
  async createValid(key: PaletteKey, region: string | null, palette: SeasonalColorPaletteResponse) {
    const parsedGeneratedAt = new Date(palette.generatedAt);
    const generatedAt = Number.isNaN(parsedGeneratedAt.getTime()) ? new Date() : parsedGeneratedAt;
    return prisma.seasonalColorPalette.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: { ...key, region, status: 'valid', colors: palette.colors, generatedAt },
      update: { region, status: 'valid', invalidReason: null, colors: palette.colors, generatedAt },
    });
  },

  async createInvalid(key: PaletteKey, region: string | null, reason: string, rawResponse: unknown) {
    // Never overwrite a valid palette with a bad one.
    const existing = await prisma.seasonalColorPalette.findUnique({ where: { season_year_fashionGender_hemisphere: key } });
    if (existing?.status === 'valid') return existing;

    const data = {
      region,
      status: 'invalid' as const,
      invalidReason: reason,
      colors: safeColors(rawResponse),
    };
    return prisma.seasonalColorPalette.upsert({
      where: { season_year_fashionGender_hemisphere: key },
      create: { ...key, ...data },
      update: data,
    });
  },
};

function safeColors(rawResponse: unknown): object {
  if (rawResponse && typeof rawResponse === 'object' && 'colors' in rawResponse) {
    return (rawResponse as Record<string, unknown>).colors as object;
  }
  return [];
}
