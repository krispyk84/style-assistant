import { closetOutfitSyncRepository } from './closet-outfit-sync.repository.js';

// Sync redesign, Phase 1A: version-aware methods below map repository rows
// to the same {status, item} shape callers get regardless of domain — item
// is null only for 'not_found'. See closet-outfit-sync.repository.ts's
// top-of-file comment for the full status-enum semantics.

function toFavouriteItem(row: { id: string; formality: string; outfit: unknown; savedAt: Date; syncVersion: number; deletedAt: Date | null } | null) {
  if (!row) return null;
  return {
    id: row.id,
    formality: row.formality,
    outfit: row.outfit,
    savedAt: row.savedAt.toISOString(),
    syncVersion: row.syncVersion,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function toWeekPlanItem(row: { dayKey: string; dayLabel: string; formality: string; outfit: unknown; assignedAt: Date; syncVersion: number; deletedAt: Date | null } | null) {
  if (!row) return null;
  return {
    dayKey: row.dayKey,
    dayLabel: row.dayLabel,
    formality: row.formality,
    outfit: row.outfit,
    assignedAt: row.assignedAt.toISOString(),
    syncVersion: row.syncVersion,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

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

  async createFavouriteVersioned(
    supabaseUserId: string,
    payload: { id: string; formality: string; outfit: unknown; savedAt: string },
  ) {
    const result = await closetOutfitSyncRepository.createFavourite({ ...payload, supabaseUserId });
    return { status: result.status, item: toFavouriteItem(result.row) };
  },

  async updateFavouriteVersioned(
    supabaseUserId: string,
    payload: { id: string; baseVersion: number; formality: string; outfit: unknown; savedAt: string },
  ) {
    const result = await closetOutfitSyncRepository.updateFavouriteVersioned({ ...payload, supabaseUserId });
    return { status: result.status, item: toFavouriteItem(result.row) };
  },

  async deleteFavouriteVersioned(supabaseUserId: string, id: string, baseVersion: number) {
    const result = await closetOutfitSyncRepository.deleteFavouriteVersioned({ id, supabaseUserId, baseVersion });
    return { status: result.status, item: toFavouriteItem(result.row) };
  },

  async createWeekPlanItemVersioned(
    supabaseUserId: string,
    payload: { dayKey: string; dayLabel: string; formality: string; outfit: unknown; assignedAt: string },
  ) {
    const result = await closetOutfitSyncRepository.createWeekPlanItem({ ...payload, supabaseUserId });
    return { status: result.status, item: toWeekPlanItem(result.row) };
  },

  async updateWeekPlanItemVersioned(
    supabaseUserId: string,
    payload: { dayKey: string; baseVersion: number; dayLabel: string; formality: string; outfit: unknown; assignedAt: string },
  ) {
    const result = await closetOutfitSyncRepository.updateWeekPlanItemVersioned({ ...payload, supabaseUserId });
    return { status: result.status, item: toWeekPlanItem(result.row) };
  },

  async deleteWeekPlanItemVersioned(supabaseUserId: string, dayKey: string, baseVersion: number) {
    const result = await closetOutfitSyncRepository.deleteWeekPlanItemVersioned({ supabaseUserId, dayKey, baseVersion });
    return { status: result.status, item: toWeekPlanItem(result.row) };
  },
};
