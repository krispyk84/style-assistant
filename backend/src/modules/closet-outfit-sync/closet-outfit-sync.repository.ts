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

  // Ownership fix (earlier session): `id` alone is ClosetOutfitFavourite's
  // only unique constraint (see schema.prisma — no compound key with
  // supabaseUserId), and this id is fully client-supplied, just like
  // saved_outfits'. A plain `prisma.upsert({where:{id}})` decides
  // create-vs-update purely by whether a row with that id exists at all,
  // with no owner comparison — so a client that knew or reused another
  // user's favourite id could silently overwrite that user's formality/
  // outfit/savedAt while the row stayed attributed to its real owner in
  // the DB. Fixed by trying an ownership-scoped update first; only
  // falling through to create if no row this caller owns was updated.
  // If the id belongs to a different user, the update matches nothing and
  // the create then hits the id's PK conflict — caught and swallowed
  // rather than surfaced, since this is a legacy fire-and-forget endpoint
  // (its route never reads a return value) and the only way this branch
  // is reached is a cross-user id collision, never a legitimate client
  // action.
  //
  // Phase 3B1 legacy compatibility bridge: the update arm now also advances
  // syncVersion by exactly one and clears deletedAt unconditionally — same
  // "legacy write == this record is active with this content" reactivation
  // semantics chosen for the direct-Supabase domains (a legacy resave
  // against a tombstoned favourite un-deletes it). Unlike the Supabase
  // bridge, there is no ambient DB trigger here to avoid double-incrementing
  // against: this repository method is the only code path that runs this
  // exact query, so the increment is written directly into its own `data`
  // and can never collide with updateFavouriteVersioned's independent CAS
  // increment (a different method, a different WHERE, never both invoked
  // for the same call).
  async upsertFavourite(params: { id: string; supabaseUserId: string; formality: string; outfit: unknown; savedAt: string }) {
    const updated = await prisma.closetOutfitFavourite.updateMany({
      where: { id: params.id, supabaseUserId: params.supabaseUserId },
      data: {
        formality: params.formality,
        outfit: params.outfit as never,
        savedAt: params.savedAt,
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
    if (updated.count > 0) return;

    try {
      await prisma.closetOutfitFavourite.create({
        data: {
          id: params.id,
          supabaseUserId: params.supabaseUserId,
          formality: params.formality,
          outfit: params.outfit as never,
          savedAt: params.savedAt,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  },

  // Phase 3B1: soft-delete instead of a physical row removal, ownership-
  // scoped exactly as before. The `deletedAt: null` guard in the WHERE
  // clause is what makes a repeated legacy delete idempotent — a second
  // call against an already-tombstoned row matches zero rows, so
  // syncVersion is left untouched (no version churn for a no-op repeat),
  // matching the direct-Supabase bridge's chosen repeated-delete semantics.
  async deleteFavourite(id: string, supabaseUserId: string) {
    await prisma.closetOutfitFavourite.updateMany({
      where: { id, supabaseUserId, deletedAt: null },
      data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
    });
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

  // Checked for the same ownership mistake as upsertFavourite (earlier
  // session): already safe, left unchanged. ClosetOutfitWeekPlanItem's
  // unique constraint is the COMPOUND key (supabaseUserId, dayKey) (see
  // schema.prisma's @@unique([supabaseUserId, dayKey])), and Prisma's
  // upsert `where` must target that exact compound key — it can only ever
  // match a row that already belongs to params.supabaseUserId (always the
  // server-derived caller id from the service layer, never client-
  // supplied). There is no id-alone lookup path here for a client to
  // collide against, so a cross-user overwrite is not possible through
  // this method.
  //
  // Phase 3B1: the `update` branch now also advances syncVersion by exactly
  // one and clears deletedAt unconditionally, reactivating a tombstoned
  // day exactly like a fresh assignment would — this is the mutable-slot
  // case Part 8 asked to reason through explicitly: a week-plan day is a
  // single mutable slot, so "assign an outfit to Monday" legitimately means
  // "Monday's slot is now this, regardless of what it was before," same as
  // the direct-Supabase week_plan bridge's chosen semantics. Prisma's own
  // upsert already does the create-or-update dispatch in one round trip;
  // no ambient trigger exists here to double-increment against (same
  // reasoning as upsertFavourite above).
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
      update: {
        dayLabel: params.dayLabel,
        formality: params.formality,
        outfit: params.outfit as never,
        assignedAt: params.assignedAt,
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
  },

  // Phase 3B1: soft-delete instead of physical row removal, preserving the
  // compound (supabaseUserId, dayKey) identity exactly as Part 16 requires
  // — the row keeps existing (as a tombstone) rather than freeing the
  // dayKey for an unrelated future row to reuse its identity. The
  // `deletedAt: null` WHERE guard makes a repeated legacy clear/delete
  // idempotent, same pattern and same rationale as deleteFavourite above.
  async deleteWeekPlanItem(dayKey: string, supabaseUserId: string) {
    await prisma.closetOutfitWeekPlanItem.updateMany({
      where: { dayKey, supabaseUserId, deletedAt: null },
      data: { deletedAt: new Date(), syncVersion: { increment: 1 } },
    });
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
