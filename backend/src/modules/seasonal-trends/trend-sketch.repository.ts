import { prisma } from '../../db/prisma.js';
import type { TrendSketchInput } from '../../ai/prompts/trend-sketch.prompts.js';

function normalizeTrendKey(name: string): string {
  return name.trim().toLowerCase();
}

export const trendSketchRepository = {
  normalizeTrendKey,

  async findByKey(fashionGender: string, trendName: string) {
    return prisma.trendSketch.findUnique({
      where: { fashionGender_trendNameKey: { fashionGender, trendNameKey: normalizeTrendKey(trendName) } },
    });
  },

  async createPending(fashionGender: string, trend: TrendSketchInput) {
    return prisma.trendSketch.create({
      data: {
        fashionGender,
        trendNameKey: normalizeTrendKey(trend.name),
        trendName: trend.name,
        formality: trend.formality,
        trendData: {
          summary: trend.summary,
          garmentCategories: trend.garmentCategories,
          silhouettes: trend.silhouettes,
          colours: trend.colours,
          materialsOrTextures: trend.materialsOrTextures,
          footwear: trend.footwear,
          accessories: trend.accessories,
        },
      },
    });
  },

  /** Called each time a freshly generated profile still contains this trend name — keeps it alive across season boundaries. */
  async touchLastSeen(id: string) {
    return prisma.trendSketch.update({ where: { id }, data: { lastSeenAt: new Date() } });
  },

  async updateSketch(
    id: string,
    data: {
      status: string;
      sketchStorageKey?: string | null;
      sketchMimeType?: string | null;
      sketchImageData?: Buffer | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return prisma.trendSketch.update({ where: { id }, data });
  },

  /**
   * Rows stuck pending or failed for longer than the given cutoff — covers
   * generation orphaned by a server restart (in-flight work only ever lived
   * in memory) as well as genuine failures, so both get retried.
   */
  async findStuck(olderThan: Date) {
    return prisma.trendSketch.findMany({
      where: { status: { in: ['pending', 'failed'] }, firstGeneratedAt: { lt: olderThan } },
    });
  },
};
