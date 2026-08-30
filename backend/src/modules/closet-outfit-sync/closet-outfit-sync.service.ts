import { closetOutfitSyncRepository } from './closet-outfit-sync.repository.js';

export const closetOutfitSyncService = {
  async getFavourites(supabaseUserId: string) {
    const rows = await closetOutfitSyncRepository.findAllFavourites(supabaseUserId);
    return rows.map((row) => ({
      id: row.id,
      formality: row.formality,
      outfit: row.outfit,
      savedAt: row.savedAt.toISOString(),
    }));
  },

  async upsertFavourite(
    supabaseUserId: string,
    payload: { id: string; formality: string; outfit: unknown; savedAt: string },
  ) {
    await closetOutfitSyncRepository.upsertFavourite({ ...payload, supabaseUserId });
  },

  async deleteFavourite(supabaseUserId: string, id: string) {
    await closetOutfitSyncRepository.deleteFavourite(id, supabaseUserId);
  },

  async getWeekPlan(supabaseUserId: string) {
    const rows = await closetOutfitSyncRepository.findAllWeekPlanItems(supabaseUserId);
    return rows.map((row) => ({
      dayKey: row.dayKey,
      dayLabel: row.dayLabel,
      formality: row.formality,
      outfit: row.outfit,
      assignedAt: row.assignedAt.toISOString(),
    }));
  },

  async upsertWeekPlanItem(
    supabaseUserId: string,
    payload: { dayKey: string; dayLabel: string; formality: string; outfit: unknown; assignedAt: string },
  ) {
    await closetOutfitSyncRepository.upsertWeekPlanItem({ ...payload, supabaseUserId });
  },

  async deleteWeekPlanItem(supabaseUserId: string, dayKey: string) {
    await closetOutfitSyncRepository.deleteWeekPlanItem(dayKey, supabaseUserId);
  },
};
