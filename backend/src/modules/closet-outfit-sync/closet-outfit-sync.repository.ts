import { prisma } from '../../db/prisma.js';

// Cloud backup for "Create Outfits From My Closet" favourites + week plan —
// see schema.prisma's ClosetOutfitFavourite/ClosetOutfitWeekPlanItem doc
// comments for why this exists (it previously had zero server-side copy).

export const closetOutfitSyncRepository = {
  async findAllFavourites(supabaseUserId: string) {
    return prisma.closetOutfitFavourite.findMany({
      where: { supabaseUserId },
      orderBy: { savedAt: 'desc' },
    });
  },

  async upsertFavourite(params: { id: string; supabaseUserId: string; formality: string; outfit: unknown; savedAt: string }) {
    return prisma.closetOutfitFavourite.upsert({
      where: { id: params.id },
      create: { ...params, outfit: params.outfit as never },
      update: { formality: params.formality, outfit: params.outfit as never, savedAt: params.savedAt },
    });
  },

  async deleteFavourite(id: string, supabaseUserId: string) {
    await prisma.closetOutfitFavourite.deleteMany({ where: { id, supabaseUserId } });
  },

  async findAllWeekPlanItems(supabaseUserId: string) {
    return prisma.closetOutfitWeekPlanItem.findMany({
      where: { supabaseUserId },
      orderBy: { dayKey: 'asc' },
    });
  },

  async upsertWeekPlanItem(params: {
    supabaseUserId: string;
    dayKey: string;
    dayLabel: string;
    formality: string;
    outfit: unknown;
    assignedAt: string;
  }) {
    return prisma.closetOutfitWeekPlanItem.upsert({
      where: { supabaseUserId_dayKey: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey } },
      create: { ...params, outfit: params.outfit as never },
      update: { dayLabel: params.dayLabel, formality: params.formality, outfit: params.outfit as never, assignedAt: params.assignedAt },
    });
  },

  async deleteWeekPlanItem(dayKey: string, supabaseUserId: string) {
    await prisma.closetOutfitWeekPlanItem.deleteMany({ where: { dayKey, supabaseUserId } });
  },
};
