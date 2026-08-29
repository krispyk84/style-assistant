import { prisma } from '../../db/prisma.js';
import { trendSketchRepository } from './trend-sketch.repository.js';

export type TrendFeedbackValue = 'up' | 'down';

export const trendFeedbackRepository = {
  async findAllForUser(supabaseUserId: string, fashionGender: string) {
    return prisma.trendFeedback.findMany({ where: { supabaseUserId, fashionGender } });
  },

  async upsert(supabaseUserId: string, fashionGender: string, trendName: string, feedback: TrendFeedbackValue) {
    const trendNameKey = trendSketchRepository.normalizeTrendKey(trendName);
    return prisma.trendFeedback.upsert({
      where: { supabaseUserId_fashionGender_trendNameKey: { supabaseUserId, fashionGender, trendNameKey } },
      create: { supabaseUserId, fashionGender, trendNameKey, feedback },
      update: { feedback },
    });
  },

  async clear(supabaseUserId: string, fashionGender: string, trendName: string) {
    const trendNameKey = trendSketchRepository.normalizeTrendKey(trendName);
    await prisma.trendFeedback.deleteMany({ where: { supabaseUserId, fashionGender, trendNameKey } });
  },
};
