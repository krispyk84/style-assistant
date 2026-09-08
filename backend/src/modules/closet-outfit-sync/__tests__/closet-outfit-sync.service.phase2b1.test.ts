import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2B1 (sync redesign) — the reconciliation-only service methods
// exposing the tombstone-inclusive repository reads that Phase 1A added but
// never wired up to a service method/route. Same repository-mocking
// convention as closet-outfit-sync.service.phase1a.test.ts.

const findAllFavouritesIncludingDeleted = vi.fn();
const findAllWeekPlanItemsIncludingDeleted = vi.fn();

vi.mock('../closet-outfit-sync.repository.js', () => ({
  closetOutfitSyncRepository: {
    findAllFavouritesIncludingDeleted,
    findAllWeekPlanItemsIncludingDeleted,
  },
}));

const { closetOutfitSyncService } = await import('../closet-outfit-sync.service.js');

beforeEach(() => {
  findAllFavouritesIncludingDeleted.mockReset();
  findAllWeekPlanItemsIncludingDeleted.mockReset();
});

describe('closetOutfitSyncService.getFavouritesForReconciliation', () => {
  it('maps every row (live and tombstoned) with syncVersion/deletedAt included', async () => {
    findAllFavouritesIncludingDeleted.mockResolvedValue([
      { id: 'f1', formality: 'Business', outfit: { a: 1 }, savedAt: new Date('2026-01-01T00:00:00Z'), syncVersion: 1, deletedAt: null },
      { id: 'f2', formality: 'Casual', outfit: { b: 1 }, savedAt: new Date('2026-01-02T00:00:00Z'), syncVersion: 3, deletedAt: new Date('2026-01-03T00:00:00Z') },
    ]);

    const result = await closetOutfitSyncService.getFavouritesForReconciliation('user-1');

    expect(findAllFavouritesIncludingDeleted).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { id: 'f1', formality: 'Business', outfit: { a: 1 }, savedAt: '2026-01-01T00:00:00.000Z', syncVersion: 1, deletedAt: null },
      { id: 'f2', formality: 'Casual', outfit: { b: 1 }, savedAt: '2026-01-02T00:00:00.000Z', syncVersion: 3, deletedAt: '2026-01-03T00:00:00.000Z' },
    ]);
  });
});

describe('closetOutfitSyncService.getWeekPlanForReconciliation', () => {
  it('maps every row (live and tombstoned) with syncVersion/deletedAt included', async () => {
    findAllWeekPlanItemsIncludingDeleted.mockResolvedValue([
      { dayKey: 'mon', dayLabel: 'Monday', formality: 'Business', outfit: { a: 1 }, assignedAt: new Date('2026-01-05T00:00:00Z'), syncVersion: 2, deletedAt: null },
      { dayKey: 'tue', dayLabel: 'Tuesday', formality: 'Casual', outfit: { b: 1 }, assignedAt: new Date('2026-01-06T00:00:00Z'), syncVersion: 4, deletedAt: new Date('2026-01-07T00:00:00Z') },
    ]);

    const result = await closetOutfitSyncService.getWeekPlanForReconciliation('user-1');

    expect(findAllWeekPlanItemsIncludingDeleted).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { dayKey: 'mon', dayLabel: 'Monday', formality: 'Business', outfit: { a: 1 }, assignedAt: '2026-01-05T00:00:00.000Z', syncVersion: 2, deletedAt: null },
      { dayKey: 'tue', dayLabel: 'Tuesday', formality: 'Casual', outfit: { b: 1 }, assignedAt: '2026-01-06T00:00:00.000Z', syncVersion: 4, deletedAt: '2026-01-07T00:00:00.000Z' },
    ]);
  });
});
