import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3B2: fetchClosetOutfitFavouritesForReconciliation/
// fetchClosetOutfitWeekPlanForReconciliation must throw on a failed read
// (missing route, auth failure, network error) rather than resolve to []
// — see lib/domain-reconciliation-runner.ts's fetch-failure handling, which
// depends on this exact contract to abort a reconciliation run safely
// instead of treating a failed read as "zero server records."

const requestMock = vi.fn();
vi.mock('@/lib/api/api-client', () => ({
  createApiClient: () => ({ request: requestMock }),
}));

beforeEach(() => {
  requestMock.mockReset();
});

describe('fetchClosetOutfitFavouritesForReconciliation', () => {
  it('returns the mapped items on success', async () => {
    requestMock.mockResolvedValue({ success: true, data: { items: [{ id: 'f1', syncVersion: 2, deletedAt: null }] }, error: null });

    const { fetchClosetOutfitFavouritesForReconciliation } = await import('@/lib/closet-outfit-sync');
    await expect(fetchClosetOutfitFavouritesForReconciliation()).resolves.toEqual([{ id: 'f1', syncVersion: 2, deletedAt: null }]);
  });

  it('throws on failure rather than resolving to []', async () => {
    requestMock.mockResolvedValue({ success: false, data: null, error: { code: 'HTTP_ERROR', message: 'route missing' } });

    const { fetchClosetOutfitFavouritesForReconciliation } = await import('@/lib/closet-outfit-sync');
    await expect(fetchClosetOutfitFavouritesForReconciliation()).rejects.toThrow('route missing');
  });
});

describe('fetchClosetOutfitWeekPlanForReconciliation', () => {
  it('returns the mapped items on success', async () => {
    requestMock.mockResolvedValue({ success: true, data: { items: [{ dayKey: 'mon', syncVersion: 1, deletedAt: null }] }, error: null });

    const { fetchClosetOutfitWeekPlanForReconciliation } = await import('@/lib/closet-outfit-sync');
    await expect(fetchClosetOutfitWeekPlanForReconciliation()).resolves.toEqual([{ dayKey: 'mon', syncVersion: 1, deletedAt: null }]);
  });

  it('throws on failure rather than resolving to []', async () => {
    requestMock.mockResolvedValue({ success: false, data: null, error: { code: 'HTTP_ERROR', message: 'route missing' } });

    const { fetchClosetOutfitWeekPlanForReconciliation } = await import('@/lib/closet-outfit-sync');
    await expect(fetchClosetOutfitWeekPlanForReconciliation()).rejects.toThrow('route missing');
  });
});
