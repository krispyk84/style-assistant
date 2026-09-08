import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 1A — service-layer mapping: repository row -> API item shape, with
// `item: null` only on 'not_found' and every date field serialized to ISO.
// Mocks the repository the same way seasonal-trends.service.test.ts mocks
// its repository.

const createFavourite = vi.fn();
const updateFavouriteVersioned = vi.fn();
const deleteFavouriteVersioned = vi.fn();
const createWeekPlanItem = vi.fn();
const updateWeekPlanItemVersioned = vi.fn();
const deleteWeekPlanItemVersioned = vi.fn();

vi.mock('../closet-outfit-sync.repository.js', () => ({
  closetOutfitSyncRepository: {
    createFavourite,
    updateFavouriteVersioned,
    deleteFavouriteVersioned,
    createWeekPlanItem,
    updateWeekPlanItemVersioned,
    deleteWeekPlanItemVersioned,
  },
}));

const { closetOutfitSyncService } = await import('../closet-outfit-sync.service.js');

beforeEach(() => {
  createFavourite.mockReset();
  updateFavouriteVersioned.mockReset();
  deleteFavouriteVersioned.mockReset();
  createWeekPlanItem.mockReset();
  updateWeekPlanItemVersioned.mockReset();
  deleteWeekPlanItemVersioned.mockReset();
});

describe('closetOutfitSyncService — Phase 1A version-aware favourites', () => {
  it('createFavouriteVersioned maps a created row to {status, item} with ISO savedAt/deletedAt', async () => {
    createFavourite.mockResolvedValue({
      status: 'created',
      row: { id: 'f1', supabaseUserId: 'u1', formality: 'Casual', outfit: { a: 1 }, savedAt: new Date('2026-01-01T00:00:00Z'), syncVersion: 1, deletedAt: null },
    });

    const result = await closetOutfitSyncService.createFavouriteVersioned('u1', { id: 'f1', formality: 'Casual', outfit: { a: 1 }, savedAt: '2026-01-01' });

    expect(result).toEqual({
      status: 'created',
      item: { id: 'f1', formality: 'Casual', outfit: { a: 1 }, savedAt: '2026-01-01T00:00:00.000Z', syncVersion: 1, deletedAt: null },
    });
    expect(createFavourite).toHaveBeenCalledWith({ id: 'f1', formality: 'Casual', outfit: { a: 1 }, savedAt: '2026-01-01', supabaseUserId: 'u1' });
  });

  it('maps not_found to {status: not_found, item: null} without throwing', async () => {
    updateFavouriteVersioned.mockResolvedValue({ status: 'not_found', row: null });

    const result = await closetOutfitSyncService.updateFavouriteVersioned('u1', { id: 'missing', baseVersion: 1, formality: 'Casual', outfit: {}, savedAt: '2026-01-01' });

    expect(result).toEqual({ status: 'not_found', item: null });
  });

  it('maps conflict to the current authoritative item, not the caller\'s rejected payload', async () => {
    deleteFavouriteVersioned.mockResolvedValue({
      status: 'conflict',
      row: { id: 'f1', supabaseUserId: 'u1', formality: 'Business', outfit: { current: true }, savedAt: new Date('2026-02-01T00:00:00Z'), syncVersion: 9, deletedAt: null },
    });

    const result = await closetOutfitSyncService.deleteFavouriteVersioned('u1', 'f1', 1);

    expect(result).toEqual({
      status: 'conflict',
      item: { id: 'f1', formality: 'Business', outfit: { current: true }, savedAt: '2026-02-01T00:00:00.000Z', syncVersion: 9, deletedAt: null },
    });
  });
});

describe('closetOutfitSyncService — Phase 1A version-aware week plan items', () => {
  it('createWeekPlanItemVersioned maps a created row with ISO assignedAt', async () => {
    createWeekPlanItem.mockResolvedValue({
      status: 'created',
      row: { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date('2026-01-05T00:00:00Z'), syncVersion: 1, deletedAt: null },
    });

    const result = await closetOutfitSyncService.createWeekPlanItemVersioned('u1', { dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-05' });

    expect(result).toEqual({
      status: 'created',
      item: { dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-05T00:00:00.000Z', syncVersion: 1, deletedAt: null },
    });
  });

  it('maps a soft-deleted row\'s deletedAt to an ISO string, not a Date instance', async () => {
    deleteWeekPlanItemVersioned.mockResolvedValue({
      status: 'applied',
      row: { id: 'x', supabaseUserId: 'u1', dayKey: 'mon', dayLabel: 'Monday', formality: 'Casual', outfit: {}, assignedAt: new Date('2026-01-05T00:00:00Z'), syncVersion: 2, deletedAt: new Date('2026-01-06T00:00:00Z') },
    });

    const result = await closetOutfitSyncService.deleteWeekPlanItemVersioned('u1', 'mon', 1);

    expect(result.item?.deletedAt).toBe('2026-01-06T00:00:00.000Z');
    expect(typeof result.item?.deletedAt).toBe('string');
  });

  it('maps not_found to item: null for week plan updates too', async () => {
    updateWeekPlanItemVersioned.mockResolvedValue({ status: 'not_found', row: null });

    const result = await closetOutfitSyncService.updateWeekPlanItemVersioned('u1', { dayKey: 'fri', baseVersion: 1, dayLabel: 'Friday', formality: 'Casual', outfit: {}, assignedAt: '2026-01-09' });

    expect(result).toEqual({ status: 'not_found', item: null });
  });
});
