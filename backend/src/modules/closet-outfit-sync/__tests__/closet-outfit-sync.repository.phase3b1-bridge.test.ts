import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3B1: the legacy (still-installed-app) mutation methods
// (upsertFavourite/deleteFavourite/upsertWeekPlanItem/deleteWeekPlanItem)
// must now participate in the same version/tombstone lineage as the
// version-aware methods — every legacy write advances syncVersion by
// exactly one and a legacy delete becomes a soft tombstone instead of a
// physical row removal. closet-outfit-sync.repository.legacy-ownership.test.ts
// already covers upsertFavourite/deleteFavourite's bridge behavior in the
// same pass as their ownership scoping; this file covers the week-plan
// legacy methods (not touched by that file) plus the reactivation-against-
// a-tombstone case for both domains, and the CAS-methods-still-increment-
// exactly-once regression this bridge must not break.

const favouriteUpdateMany = vi.fn();
const favouriteUpdateManyVersioned = vi.fn();
const favouriteFindFirst = vi.fn();
const weekPlanUpsert = vi.fn();
const weekPlanUpdateMany = vi.fn();
const weekPlanFindUnique = vi.fn();

vi.mock('../../../db/prisma.js', () => ({
  prisma: {
    closetOutfitFavourite: {
      updateMany: (...args: unknown[]) => {
        // Distinguish the plain legacy call (2-key where) from the CAS call
        // (3-key where, includes syncVersion) purely by call site in each
        // test below — both route through the same mock, reset per test.
        return favouriteUpdateMany(...args);
      },
      findFirst: favouriteFindFirst,
    },
    closetOutfitWeekPlanItem: {
      upsert: weekPlanUpsert,
      updateMany: weekPlanUpdateMany,
      findUnique: weekPlanFindUnique,
    },
  },
}));

const { closetOutfitSyncRepository } = await import('../closet-outfit-sync.repository.js');

beforeEach(() => {
  favouriteUpdateMany.mockReset();
  favouriteUpdateManyVersioned.mockReset();
  favouriteFindFirst.mockReset();
  weekPlanUpsert.mockReset();
  weekPlanUpdateMany.mockReset();
  weekPlanFindUnique.mockReset();
});

describe('closetOutfitSyncRepository — legacy upsertWeekPlanItem bridge', () => {
  it('the update branch advances syncVersion by exactly one and clears deletedAt (reactivation)', async () => {
    weekPlanUpsert.mockResolvedValue({ supabaseUserId: 'u1', dayKey: 'mon', syncVersion: 2, deletedAt: null });

    await closetOutfitSyncRepository.upsertWeekPlanItem({
      supabaseUserId: 'u1',
      dayKey: 'mon',
      dayLabel: 'Monday',
      formality: 'Casual',
      outfit: { a: 1 },
      assignedAt: '2026-01-01',
    });

    expect(weekPlanUpsert).toHaveBeenCalledWith({
      where: { supabaseUserId_dayKey: { supabaseUserId: 'u1', dayKey: 'mon' } },
      create: {
        supabaseUserId: 'u1',
        dayKey: 'mon',
        dayLabel: 'Monday',
        formality: 'Casual',
        outfit: { a: 1 },
        assignedAt: '2026-01-01',
      },
      update: {
        dayLabel: 'Monday',
        formality: 'Casual',
        outfit: { a: 1 },
        assignedAt: '2026-01-01',
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
  });
});

describe('closetOutfitSyncRepository — legacy deleteWeekPlanItem bridge', () => {
  it('soft-deletes (updateMany, not deleteMany) scoped by dayKey + supabaseUserId + deletedAt:null', async () => {
    weekPlanUpdateMany.mockResolvedValue({ count: 1 });

    await closetOutfitSyncRepository.deleteWeekPlanItem('mon', 'u1');

    expect(weekPlanUpdateMany).toHaveBeenCalledWith({
      where: { dayKey: 'mon', supabaseUserId: 'u1', deletedAt: null },
      data: { deletedAt: expect.any(Date), syncVersion: { increment: 1 } },
    });
  });

  it('a repeated legacy delete against an already-tombstoned day matches zero rows (idempotent)', async () => {
    weekPlanUpdateMany.mockResolvedValue({ count: 0 });

    await expect(closetOutfitSyncRepository.deleteWeekPlanItem('mon', 'u1')).resolves.toBeUndefined();

    expect(weekPlanUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe('closetOutfitSyncRepository — CAS methods still increment exactly once (no interaction with the legacy bridge)', () => {
  it('updateFavouriteVersioned increments syncVersion by exactly one, independent of the legacy bridge change', async () => {
    favouriteUpdateMany.mockResolvedValue({ count: 1 });
    favouriteFindFirst.mockResolvedValue({ id: 'f1', supabaseUserId: 'u1', syncVersion: 2 });

    const result = await closetOutfitSyncRepository.updateFavouriteVersioned({
      id: 'f1',
      supabaseUserId: 'u1',
      baseVersion: 1,
      formality: 'Business',
      outfit: {},
      savedAt: '2026-01-01',
    });

    expect(favouriteUpdateMany).toHaveBeenCalledWith({
      where: { id: 'f1', supabaseUserId: 'u1', syncVersion: 1 },
      data: {
        formality: 'Business',
        outfit: {},
        savedAt: '2026-01-01',
        syncVersion: { increment: 1 },
        deletedAt: null,
      },
    });
    expect(result.status).toBe('applied');
  });
});
