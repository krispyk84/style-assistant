import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

// Cloud backup for "Create Outfits From My Closet" favourites + week plan —
// see schema.prisma's ClosetOutfitFavourite/ClosetOutfitWeekPlanItem doc
// comments for why this exists (it previously had zero server-side copy).

// Sync redesign, Phase 1A: version-aware mutation methods below, additive
// alongside the legacy upsert/delete methods above (which stay exactly as
// they are — nothing currently installed calls the new methods). Same
// create/update/delete semantics as the saved_outfits/week_plan Postgres
// RPCs in supabase/migrations/20260907010000_phase1a_version_aware_rpcs.sql:
// create only succeeds if no row exists yet (never an unconditional
// overwrite); update/delete require an exact syncVersion match via a
// single atomic updateMany (never select-then-compare-then-update); delete
// is always soft (deletedAt set, row retained); a version-matched update
// always clears deletedAt (the deliberate-reassignment/CAS-against-a-
// tombstone case, not an automatic undelete of a stale write — a stale
// write's WHERE clause never matches in the first place). Every method
// returns { status, row }, mirroring the RPCs' status enum: 'created' |
// 'create_conflict' | 'applied' | 'conflict' | 'not_found'.
//
// TEMPORARY-COMPAT TAG: none of this is temporary — the legacy
// upsert*/delete* methods above are what Phase 3C must eventually retire
// once the frontend switches to calling these version-aware methods.

type SyncStatus = 'created' | 'create_conflict' | 'applied' | 'conflict' | 'not_found';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export const closetOutfitSyncRepository = {
  async findAllFavourites(supabaseUserId: string) {
    // deletedAt: null keeps this ordinary read tombstone-free — see Phase
    // 1A's findAllFavouritesIncludingDeleted below for the reconciliation-
    // only variant that needs to see soft-deleted rows.
    return prisma.closetOutfitFavourite.findMany({
      where: { supabaseUserId, deletedAt: null },
      orderBy: { savedAt: 'desc' },
    });
  },

  // Sync redesign, Phase 1A: exposed now so Phase 2's reconciliation engine
  // has a read path that can see tombstones and sync versions; nothing
  // calls this yet.
  async findAllFavouritesIncludingDeleted(supabaseUserId: string) {
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
      where: { supabaseUserId, deletedAt: null },
      orderBy: { dayKey: 'asc' },
    });
  },

  // Sync redesign, Phase 1A: reconciliation-only read path, see
  // findAllFavouritesIncludingDeleted's comment above.
  async findAllWeekPlanItemsIncludingDeleted(supabaseUserId: string) {
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

  async createFavourite(params: { id: string; supabaseUserId: string; formality: string; outfit: unknown; savedAt: string }) {
    try {
      const row = await prisma.closetOutfitFavourite.create({
        data: { ...params, outfit: params.outfit as never },
      });
      return { status: 'created' as SyncStatus, row };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const existing = await prisma.closetOutfitFavourite.findFirst({
        where: { id: params.id, supabaseUserId: params.supabaseUserId },
      });
      return { status: 'create_conflict' as SyncStatus, row: existing };
    }
  },

  async updateFavouriteVersioned(params: {
    id: string;
    supabaseUserId: string;
    baseVersion: number;
    formality: string;
    outfit: unknown;
    savedAt: string;
  }) {
    const result = await prisma.closetOutfitFavourite.updateMany({
      where: { id: params.id, supabaseUserId: params.supabaseUserId, syncVersion: params.baseVersion },
      data: {
        formality: params.formality,
        outfit: params.outfit as never,
        savedAt: params.savedAt,
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
    const existing = await prisma.closetOutfitFavourite.findFirst({
      where: { id: params.id, supabaseUserId: params.supabaseUserId },
    });
    if (result.count > 0) return { status: 'applied' as SyncStatus, row: existing };
    return { status: (existing ? 'conflict' : 'not_found') as SyncStatus, row: existing };
  },

  async deleteFavouriteVersioned(params: { id: string; supabaseUserId: string; baseVersion: number }) {
    const result = await prisma.closetOutfitFavourite.updateMany({
      where: { id: params.id, supabaseUserId: params.supabaseUserId, syncVersion: params.baseVersion },
      data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
    });
    const existing = await prisma.closetOutfitFavourite.findFirst({
      where: { id: params.id, supabaseUserId: params.supabaseUserId },
    });
    if (result.count > 0) return { status: 'applied' as SyncStatus, row: existing };
    return { status: (existing ? 'conflict' : 'not_found') as SyncStatus, row: existing };
  },

  async createWeekPlanItem(params: {
    supabaseUserId: string;
    dayKey: string;
    dayLabel: string;
    formality: string;
    outfit: unknown;
    assignedAt: string;
  }) {
    try {
      const row = await prisma.closetOutfitWeekPlanItem.create({
        data: { ...params, outfit: params.outfit as never },
      });
      return { status: 'created' as SyncStatus, row };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const existing = await prisma.closetOutfitWeekPlanItem.findUnique({
        where: { supabaseUserId_dayKey: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey } },
      });
      return { status: 'create_conflict' as SyncStatus, row: existing };
    }
  },

  async updateWeekPlanItemVersioned(params: {
    supabaseUserId: string;
    dayKey: string;
    baseVersion: number;
    dayLabel: string;
    formality: string;
    outfit: unknown;
    assignedAt: string;
  }) {
    const result = await prisma.closetOutfitWeekPlanItem.updateMany({
      where: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey, syncVersion: params.baseVersion },
      data: {
        dayLabel: params.dayLabel,
        formality: params.formality,
        outfit: params.outfit as never,
        assignedAt: params.assignedAt,
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
    const existing = await prisma.closetOutfitWeekPlanItem.findUnique({
      where: { supabaseUserId_dayKey: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey } },
    });
    if (result.count > 0) return { status: 'applied' as SyncStatus, row: existing };
    return { status: (existing ? 'conflict' : 'not_found') as SyncStatus, row: existing };
  },

  async deleteWeekPlanItemVersioned(params: { supabaseUserId: string; dayKey: string; baseVersion: number }) {
    const result = await prisma.closetOutfitWeekPlanItem.updateMany({
      where: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey, syncVersion: params.baseVersion },
      data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
    });
    const existing = await prisma.closetOutfitWeekPlanItem.findUnique({
      where: { supabaseUserId_dayKey: { supabaseUserId: params.supabaseUserId, dayKey: params.dayKey } },
    });
    if (result.count > 0) return { status: 'applied' as SyncStatus, row: existing };
    return { status: (existing ? 'conflict' : 'not_found') as SyncStatus, row: existing };
  },
};
