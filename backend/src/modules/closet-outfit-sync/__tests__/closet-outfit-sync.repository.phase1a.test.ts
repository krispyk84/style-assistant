import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Phase 1A of the local<->cloud sync redesign — version-aware mutation
// methods for the backend-mediated domains (ClosetOutfitFavourite /
// ClosetOutfitWeekPlanItem). Mocks prisma directly (same convention as
// seasonal-trends.service.test.ts mocking its repository) so these run
// DB-free like every other backend test — see schema-phase0.test.ts's
// comment on why this repo's backend tests never touch a live database.
// The atomic-CAS behavior of Prisma's updateMany itself (that Postgres
// really does evaluate the WHERE clause and the increment atomically) was
// verified separately against a disposable local Postgres instance as
// part of this phase's manual SQL/migration review, not re-proven here —
// this file tests that OUR code builds the right query and maps count/row
// to the right status.

const create = vi.fn();
const updateMany = vi.fn();
const findFirst = vi.fn();

const weekCreate = vi.fn();
const weekUpdateMany = vi.fn();
const weekFindUnique = vi.fn();

vi.mock('../../../db/prisma.js', () => ({
  prisma: {
    closetOutfitFavourite: { create, updateMany, findFirst },
    closetOutfitWeekPlanItem: { create: weekCreate, updateMany: weekUpdateMany, findUnique: weekFindUnique },
  },
}));

const { closetOutfitSyncRepository } = await import('../closet-outfit-sync.repository.js');

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

beforeEach(() => {
  create.mockReset();
  updateMany.mockReset();
  findFirst.mockReset();
  weekCreate.mockReset();
  weekUpdateMany.mockReset();
  weekFindUnique.mockReset();
});

describe('closetOutfitSyncRepository — Phase 1A version-aware favourites', () => {
  it('createFavourite returns created with the new row on success', async () => {
    const row = { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: new Date(), syncVersion: 1, deletedAt: null };
    create.mockResolvedValue(row);

    const result = await closetOutfitSyncRepository.createFavourite({
      id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: '2026-01-01',
    });

    expect(result).toEqual({ status: 'created', row });
    expect(create).toHaveBeenCalledWith({
      data: { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: '2026-01-01' },
    });
  });

  it('createFavourite returns create_conflict with the existing row on a P2002 (id already exists)', async () => {
    create.mockRejectedValue(p2002());
    const existing = { id: 'f1', supabaseUserId: 'u1', formality: 'Business', outfit: {}, savedAt: new Date(), syncVersion: 3, deletedAt: null };
    findFirst.mockResolvedValue(existing);

    const result = await closetOutfitSyncRepository.createFavourite({
      id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: '2026-01-01',
    });

    expect(result).toEqual({ status: 'create_conflict', row: existing });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'f1', supabaseUserId: 'u1' } });
  });

  it('createFavourite rethrows non-P2002 errors instead of swallowing them', async () => {
    create.mockRejectedValue(new Error('connection lost'));

    await expect(
      closetOutfitSyncRepository.createFavourite({ id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: '2026-01-01' })
    ).rejects.toThrow('connection lost');
  });

  it('updateFavouriteVersioned applies when updateMany matches exactly the given baseVersion', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 'f1', supabaseUserId: 'u1', formality: 'Business', outfit: {}, savedAt: new Date(), syncVersion: 2, deletedAt: null };
    findFirst.mockResolvedValue(updated);

    const result = await closetOutfitSyncRepository.updateFavouriteVersioned({
      id: 'f1', supabaseUserId: 'u1', baseVersion: 1, formality: 'Business', outfit: {}, savedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'applied', row: updated });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'f1', supabaseUserId: 'u1', syncVersion: 1 },
      data: { formality: 'Business', outfit: {}, savedAt: '2026-01-02', syncVersion: { increment: 1 }, deletedAt: null },
    });
  });

  it('updateFavouriteVersioned returns conflict with the current row when baseVersion is stale but the row exists', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const current = { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: new Date(), syncVersion: 5, deletedAt: null };
    findFirst.mockResolvedValue(current);

    const result = await closetOutfitSyncRepository.updateFavouriteVersioned({
      id: 'f1', supabaseUserId: 'u1', baseVersion: 1, formality: 'Business', outfit: {}, savedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'conflict', row: current });
  });

  it('updateFavouriteVersioned returns not_found (row: null) when no row matches this id/owner at all', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    const result = await closetOutfitSyncRepository.updateFavouriteVersioned({
      id: 'missing', supabaseUserId: 'u1', baseVersion: 1, formality: 'Business', outfit: {}, savedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'not_found', row: null });
  });

  it('updateFavouriteVersioned scopes the WHERE clause by the caller\'s own supabaseUserId, not just id', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    await closetOutfitSyncRepository.updateFavouriteVersioned({
      id: 'f1', supabaseUserId: 'attacker', baseVersion: 1, formality: 'x', outfit: {}, savedAt: '2026-01-02',
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'f1', supabaseUserId: 'attacker' }) })
    );
  });

  it('deleteFavouriteVersioned soft-deletes: sets deletedAt and increments syncVersion, never a physical delete call', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const deleted = { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: new Date(), syncVersion: 2, deletedAt: new Date() };
    findFirst.mockResolvedValue(deleted);

    const result = await closetOutfitSyncRepository.deleteFavouriteVersioned({ id: 'f1', supabaseUserId: 'u1', baseVersion: 1 });

    expect(result).toEqual({ status: 'applied', row: deleted });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'f1', supabaseUserId: 'u1', syncVersion: 1 },
      data: { deletedAt: expect.any(Date), syncVersion: { increment: 1 } },
    });
  });

  it('deleteFavouriteVersioned returns conflict on a stale baseVersion without deleting anything', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const current = { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: {}, savedAt: new Date(), syncVersion: 4, deletedAt: null };
    findFirst.mockResolvedValue(current);

    const result = await closetOutfitSyncRepository.deleteFavouriteVersioned({ id: 'f1', supabaseUserId: 'u1', baseVersion: 1 });

    expect(result).toEqual({ status: 'conflict', row: current });
  });
});

describe('closetOutfitSyncRepository — Phase 1A version-aware week plan items', () => {
  it('createWeekPlanItem returns created on success', async () => {
    const row = { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date(), syncVersion: 1, deletedAt: null };
    weekCreate.mockResolvedValue(row);

    const result = await closetOutfitSyncRepository.createWeekPlanItem({
      supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-01',
    });

    expect(result).toEqual({ status: 'created', row });
  });

  it('createWeekPlanItem returns create_conflict via the compound-key lookup on a P2002 — the tombstone-reuse guard: a day with any existing row (live or tombstoned) must go through update, not create', async () => {
    weekCreate.mockRejectedValue(p2002());
    const existing = { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date(), syncVersion: 3, deletedAt: new Date() };
    weekFindUnique.mockResolvedValue(existing);

    const result = await closetOutfitSyncRepository.createWeekPlanItem({
      supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-01',
    });

    expect(result).toEqual({ status: 'create_conflict', row: existing });
    expect(weekFindUnique).toHaveBeenCalledWith({ where: { supabaseUserId_dayKey: { supabaseUserId: 'u1', dayKey: 'mon' } } });
  });

  it('updateWeekPlanItemVersioned applies and clears deletedAt — the legitimate tombstone-reassignment path, not an automatic undelete (a stale baseVersion never reaches this branch)', async () => {
    weekUpdateMany.mockResolvedValue({ count: 1 });
    const revived = { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Business', outfit: {}, assignedAt: new Date(), syncVersion: 4, deletedAt: null };
    weekFindUnique.mockResolvedValue(revived);

    const result = await closetOutfitSyncRepository.updateWeekPlanItemVersioned({
      supabaseUserId: 'u1', dayKey: 'mon', baseVersion: 3, dayLabel: 'Monday', formality: 'Business', outfit: {}, assignedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'applied', row: revived });
    expect(weekUpdateMany).toHaveBeenCalledWith({
      where: { supabaseUserId: 'u1', dayKey: 'mon', syncVersion: 3 },
      data: { dayLabel: 'Monday', formality: 'Business', outfit: {}, assignedAt: '2026-01-02', syncVersion: { increment: 1 }, deletedAt: null },
    });
  });

  it('updateWeekPlanItemVersioned returns not_found for a day that was never assigned', async () => {
    weekUpdateMany.mockResolvedValue({ count: 0 });
    weekFindUnique.mockResolvedValue(null);

    const result = await closetOutfitSyncRepository.updateWeekPlanItemVersioned({
      supabaseUserId: 'u1', dayKey: 'fri', baseVersion: 1, dayLabel: 'Friday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'not_found', row: null });
  });

  it('updateWeekPlanItemVersioned returns conflict on a stale baseVersion when the day is already assigned to something else', async () => {
    weekUpdateMany.mockResolvedValue({ count: 0 });
    const current = { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date(), syncVersion: 7, deletedAt: null };
    weekFindUnique.mockResolvedValue(current);

    const result = await closetOutfitSyncRepository.updateWeekPlanItemVersioned({
      supabaseUserId: 'u1', dayKey: 'mon', baseVersion: 1, dayLabel: 'Monday', formality: 'Business', outfit: {}, assignedAt: '2026-01-02',
    });

    expect(result).toEqual({ status: 'conflict', row: current });
  });

  it('deleteWeekPlanItemVersioned soft-deletes and increments version', async () => {
    weekUpdateMany.mockResolvedValue({ count: 1 });
    const deleted = { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date(), syncVersion: 2, deletedAt: new Date() };
    weekFindUnique.mockResolvedValue(deleted);

    const result = await closetOutfitSyncRepository.deleteWeekPlanItemVersioned({ supabaseUserId: 'u1', dayKey: 'mon', baseVersion: 1 });

    expect(result).toEqual({ status: 'applied', row: deleted });
    expect(weekUpdateMany).toHaveBeenCalledWith({
      where: { supabaseUserId: 'u1', dayKey: 'mon', syncVersion: 1 },
      data: { deletedAt: expect.any(Date), syncVersion: { increment: 1 } },
    });
  });

  it('deleteWeekPlanItemVersioned scopes by supabaseUserId so another user cannot CAS someone else\'s day', async () => {
    weekUpdateMany.mockResolvedValue({ count: 0 });
    weekFindUnique.mockResolvedValue(null);

    await closetOutfitSyncRepository.deleteWeekPlanItemVersioned({ supabaseUserId: 'attacker', dayKey: 'mon', baseVersion: 1 });

    expect(weekUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ supabaseUserId: 'attacker', dayKey: 'mon' }) })
    );
  });
});

describe('closetOutfitSyncRepository — ordinary reads stay tombstone-free', () => {
  it('findAllFavourites filters deletedAt: null', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    // Reassign the mocked module's findMany just for this read-path check.
    (await import('../../../db/prisma.js')).prisma.closetOutfitFavourite.findMany = findMany;

    await closetOutfitSyncRepository.findAllFavourites('u1');

    expect(findMany).toHaveBeenCalledWith({ where: { supabaseUserId: 'u1', deletedAt: null }, orderBy: { savedAt: 'desc' } });
  });

  it('findAllFavouritesIncludingDeleted has no deletedAt filter (the reconciliation-only read path)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    (await import('../../../db/prisma.js')).prisma.closetOutfitFavourite.findMany = findMany;

    await closetOutfitSyncRepository.findAllFavouritesIncludingDeleted('u1');

    expect(findMany).toHaveBeenCalledWith({ where: { supabaseUserId: 'u1' }, orderBy: { savedAt: 'desc' } });
  });

  it('findAllWeekPlanItems filters deletedAt: null', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    (await import('../../../db/prisma.js')).prisma.closetOutfitWeekPlanItem.findMany = findMany;

    await closetOutfitSyncRepository.findAllWeekPlanItems('u1');

    expect(findMany).toHaveBeenCalledWith({ where: { supabaseUserId: 'u1', deletedAt: null }, orderBy: { dayKey: 'asc' } });
  });

  it('findAllWeekPlanItemsIncludingDeleted has no deletedAt filter', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    (await import('../../../db/prisma.js')).prisma.closetOutfitWeekPlanItem.findMany = findMany;

    await closetOutfitSyncRepository.findAllWeekPlanItemsIncludingDeleted('u1');

    expect(findMany).toHaveBeenCalledWith({ where: { supabaseUserId: 'u1' }, orderBy: { dayKey: 'asc' } });
  });
});
