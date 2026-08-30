import { prisma } from '../../db/prisma.js';
import { colorSwatchSketchRepository } from './color-swatch-sketch.repository.js';

export type ColorFeedbackValue = 'up' | 'down';

export const colorFeedbackRepository = {
  async findAllForUser(supabaseUserId: string, fashionGender: string) {
    return prisma.colorFeedback.findMany({ where: { supabaseUserId, fashionGender } });
  },

  async upsert(supabaseUserId: string, fashionGender: string, colorName: string, feedback: ColorFeedbackValue) {
    const colorNameKey = colorSwatchSketchRepository.normalizeColorKey(colorName);
    return prisma.colorFeedback.upsert({
      where: { supabaseUserId_fashionGender_colorNameKey: { supabaseUserId, fashionGender, colorNameKey } },
      create: { supabaseUserId, fashionGender, colorNameKey, feedback },
      update: { feedback },
    });
  },

  async clear(supabaseUserId: string, fashionGender: string, colorName: string) {
    const colorNameKey = colorSwatchSketchRepository.normalizeColorKey(colorName);
    await prisma.colorFeedback.deleteMany({ where: { supabaseUserId, fashionGender, colorNameKey } });
  },
};
