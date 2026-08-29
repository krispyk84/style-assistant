import { prisma } from '../../db/prisma.js';

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

  async createPending(fashionGender: string, trendName: string, formality: string) {
    return prisma.trendSketch.create({
      data: { fashionGender, trendNameKey: normalizeTrendKey(trendName), trendName, formality },
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
};
