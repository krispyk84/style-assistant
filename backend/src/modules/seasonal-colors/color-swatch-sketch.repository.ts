import { prisma } from '../../db/prisma.js';
import type { ColorSwatchSketchInput } from '../../ai/prompts/color-swatch-sketch.prompts.js';

function normalizeColorKey(name: string): string {
  return name.trim().toLowerCase();
}

export const colorSwatchSketchRepository = {
  normalizeColorKey,

  async findByKey(fashionGender: string, colorName: string) {
    return prisma.colorSwatchSketch.findUnique({
      where: { fashionGender_colorNameKey: { fashionGender, colorNameKey: normalizeColorKey(colorName) } },
    });
  },

  async createPending(fashionGender: string, color: ColorSwatchSketchInput) {
    return prisma.colorSwatchSketch.create({
      data: {
        fashionGender,
        colorNameKey: normalizeColorKey(color.name),
        colorName: color.name,
        colorData: {
          hex: color.hex,
          description: color.description,
        },
      },
    });
  },

  /** Called each time a freshly generated palette still contains this colour name — keeps it alive across season boundaries. */
  async touchLastSeen(id: string) {
    return prisma.colorSwatchSketch.update({ where: { id }, data: { lastSeenAt: new Date() } });
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
    return prisma.colorSwatchSketch.update({ where: { id }, data });
  },

  /**
   * Rows stuck pending or failed for longer than the given cutoff — covers
   * generation orphaned by a server restart (in-flight work only ever lived
   * in memory) as well as genuine failures, so both get retried.
   */
  async findStuck(olderThan: Date) {
    return prisma.colorSwatchSketch.findMany({
      where: { status: { in: ['pending', 'failed'] }, firstGeneratedAt: { lt: olderThan } },
    });
  },

  /**
   * Rows not seen in the current top-N for longer than the given cutoff —
   * touchLastSeen() refreshes lastSeenAt every time a freshly generated
   * palette still contains this colour, so a row this old has genuinely
   * fallen out of rotation across at least one full season cycle.
   */
  async deleteStale(olderThan: Date) {
    const result = await prisma.colorSwatchSketch.deleteMany({ where: { lastSeenAt: { lt: olderThan } } });
    return result.count;
  },
};
