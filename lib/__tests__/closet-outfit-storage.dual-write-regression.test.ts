import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A3 §23 MANDATORY regression test: proves a closet-outfit-favourite
// favourite/unfavourite through the real lib/closet-outfit-storage.ts entry
// points can NEVER invoke both the legacy backend-mediated mutation AND the
// version-aware RPC path for the same operation. Also confirms the
// untouched closet-outfit-week-plan sibling in the SAME file still uses
// only its legacy path — this phase must not accidentally migrate it too.

const storageMock = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => { storageMock.set(key, value); return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { storageMock.delete(key); return Promise.resolve(); }),
  },
}));

vi.mock('@/lib/crashlytics', () => ({ recordError: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/api/api-client', () => ({ createApiClient: vi.fn() }));

const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserId(),
  createSavedOutfitViaRpc: vi.fn(),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
  createWeekPlanItemViaRpc: vi.fn(),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

const upsertClosetOutfitFavouriteToBackend = vi.fn().mockResolvedValue(undefined);
const deleteClosetOutfitFavouriteFromBackend = vi.fn().mockResolvedValue(undefined);
const upsertClosetOutfitWeekPlanItemToBackend = vi.fn().mockResolvedValue(undefined);
const deleteClosetOutfitWeekPlanItemFromBackend = vi.fn().mockResolvedValue(undefined);
const fetchClosetOutfitFavouritesForReconciliation = vi.fn().mockResolvedValue([]);
const createClosetOutfitFavouriteViaRpc = vi.fn();
const updateClosetOutfitFavouriteViaRpc = vi.fn();
const deleteClosetOutfitFavouriteViaRpc = vi.fn();
vi.mock('@/lib/closet-outfit-sync', () => ({
  // Legacy favourite architecture — must never be called from the new path.
  upsertClosetOutfitFavouriteToBackend: (...args: unknown[]) => upsertClosetOutfitFavouriteToBackend(...args),
  deleteClosetOutfitFavouriteFromBackend: (...args: unknown[]) => deleteClosetOutfitFavouriteFromBackend(...args),
  // Legacy week-plan-item architecture — the untouched sibling; must STILL
  // be the only thing closet-outfit-week-plan actions ever call.
  upsertClosetOutfitWeekPlanItemToBackend: (...args: unknown[]) => upsertClosetOutfitWeekPlanItemToBackend(...args),
  deleteClosetOutfitWeekPlanItemFromBackend: (...args: unknown[]) => deleteClosetOutfitWeekPlanItemFromBackend(...args),
  // Version-aware favourite architecture — the only one the new path may use.
  fetchClosetOutfitFavouritesForReconciliation: () => fetchClosetOutfitFavouritesForReconciliation(),
  createClosetOutfitFavouriteViaRpc: (...args: unknown[]) => createClosetOutfitFavouriteViaRpc(...args),
  updateClosetOutfitFavouriteViaRpc: (...args: unknown[]) => updateClosetOutfitFavouriteViaRpc(...args),
  deleteClosetOutfitFavouriteViaRpc: (...args: unknown[]) => deleteClosetOutfitFavouriteViaRpc(...args),
  createClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  updateClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  deleteClosetOutfitWeekPlanItemViaRpc: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertClosetOutfitFavouriteToBackend.mockClear();
  deleteClosetOutfitFavouriteFromBackend.mockClear();
  upsertClosetOutfitWeekPlanItemToBackend.mockClear();
  deleteClosetOutfitWeekPlanItemFromBackend.mockClear();
  getCurrentUserId.mockClear().mockResolvedValue('user-1');
  fetchClosetOutfitFavouritesForReconciliation.mockClear().mockResolvedValue([]);
  createClosetOutfitFavouriteViaRpc.mockReset().mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
  updateClosetOutfitFavouriteViaRpc.mockReset();
  deleteClosetOutfitFavouriteViaRpc.mockReset().mockResolvedValue({ status: 'applied', version: 2, deletedAt: '2026-01-01T00:00:00Z', content: null });
});

const OUTFIT = { id: 'outfit-dual-1' } as unknown as import('@/types/api').ClosetGeneratedOutfit;

describe('closet-outfit-favourites dual-write regression (mandatory)', () => {
  it('favouriting an outfit invokes ONLY the version-aware create path — legacy upsertClosetOutfitFavouriteToBackend is never called', async () => {
    const { saveClosetOutfitToFavourites } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    const saved = await saveClosetOutfitToFavourites('business', OUTFIT);
    await reconcileClosetOutfitFavourites();

    expect(upsertClosetOutfitFavouriteToBackend).toHaveBeenCalledTimes(0);
    expect(createClosetOutfitFavouriteViaRpc).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitFavouriteViaRpc.mock.calls[0]![0]).toMatchObject({ id: saved.id });
  });

  it('unfavouriting invokes ONLY the version-aware CAS delete path — legacy physical delete is never called', async () => {
    const { saveClosetOutfitToFavourites, deleteSavedClosetOutfit } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    const saved = await saveClosetOutfitToFavourites('business', OUTFIT);
    await reconcileClosetOutfitFavourites();
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...saved, syncVersion: 1, deletedAt: null }]);
    upsertClosetOutfitFavouriteToBackend.mockClear();

    await deleteSavedClosetOutfit(saved.id);
    await reconcileClosetOutfitFavourites();

    expect(upsertClosetOutfitFavouriteToBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitFavouriteFromBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitFavouriteViaRpc).toHaveBeenCalledWith(saved.id, 1);
  });

  it('across a full favourite-then-unfavourite lifecycle, the legacy favourite architecture is invoked exactly zero times', async () => {
    const { saveClosetOutfitToFavourites, deleteSavedClosetOutfit } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    const saved = await saveClosetOutfitToFavourites('business', OUTFIT);
    await reconcileClosetOutfitFavourites();
    await deleteSavedClosetOutfit(saved.id);
    await reconcileClosetOutfitFavourites();

    expect(upsertClosetOutfitFavouriteToBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitFavouriteFromBackend).not.toHaveBeenCalled();
  });

  it('confirms closet-outfit-week-plan remains legacy-only: assigning/removing a week-plan day still calls ONLY the legacy backend methods, never any version-aware RPC', async () => {
    const { assignClosetOutfitToWeekDay, removeClosetWeekPlanDay } = await import('@/lib/closet-outfit-storage');

    await assignClosetOutfitToWeekDay('2026-09-14', 'Monday', 'business', OUTFIT);
    await removeClosetWeekPlanDay('2026-09-14');

    expect(upsertClosetOutfitWeekPlanItemToBackend).toHaveBeenCalledTimes(1);
    expect(deleteClosetOutfitWeekPlanItemFromBackend).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(updateClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(deleteClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
  });
});
