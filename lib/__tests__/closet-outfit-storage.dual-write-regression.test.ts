import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A3/3A4 MANDATORY regression test: proves closet-outfit-favourites
// AND closet-outfit-week-plan (both domains living in lib/closet-outfit-storage.ts)
// through their real storage entry points can NEVER invoke both the legacy
// backend-mediated mutation AND the version-aware RPC path for the same
// operation. As of Phase 3A4, BOTH domains in this file are fully migrated
// — there is no longer a "still legacy" sibling to confirm here (that
// distinction lived in this file through Phase 3A3; see git history for the
// prior version if needed).

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
const fetchClosetOutfitWeekPlanForReconciliation = vi.fn().mockResolvedValue([]);
const createClosetOutfitWeekPlanItemViaRpc = vi.fn();
const updateClosetOutfitWeekPlanItemViaRpc = vi.fn();
const deleteClosetOutfitWeekPlanItemViaRpc = vi.fn();
vi.mock('@/lib/closet-outfit-sync', () => ({
  // Legacy architecture, both domains — must never be called from the new path.
  upsertClosetOutfitFavouriteToBackend: (...args: unknown[]) => upsertClosetOutfitFavouriteToBackend(...args),
  deleteClosetOutfitFavouriteFromBackend: (...args: unknown[]) => deleteClosetOutfitFavouriteFromBackend(...args),
  upsertClosetOutfitWeekPlanItemToBackend: (...args: unknown[]) => upsertClosetOutfitWeekPlanItemToBackend(...args),
  deleteClosetOutfitWeekPlanItemFromBackend: (...args: unknown[]) => deleteClosetOutfitWeekPlanItemFromBackend(...args),
  // Version-aware architecture, both domains — the only ones the new path may use.
  fetchClosetOutfitFavouritesForReconciliation: () => fetchClosetOutfitFavouritesForReconciliation(),
  createClosetOutfitFavouriteViaRpc: (...args: unknown[]) => createClosetOutfitFavouriteViaRpc(...args),
  updateClosetOutfitFavouriteViaRpc: (...args: unknown[]) => updateClosetOutfitFavouriteViaRpc(...args),
  deleteClosetOutfitFavouriteViaRpc: (...args: unknown[]) => deleteClosetOutfitFavouriteViaRpc(...args),
  fetchClosetOutfitWeekPlanForReconciliation: () => fetchClosetOutfitWeekPlanForReconciliation(),
  createClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => createClosetOutfitWeekPlanItemViaRpc(...args),
  updateClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => updateClosetOutfitWeekPlanItemViaRpc(...args),
  deleteClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => deleteClosetOutfitWeekPlanItemViaRpc(...args),
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
  fetchClosetOutfitWeekPlanForReconciliation.mockClear().mockResolvedValue([]);
  createClosetOutfitWeekPlanItemViaRpc.mockReset().mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
  updateClosetOutfitWeekPlanItemViaRpc.mockReset();
  deleteClosetOutfitWeekPlanItemViaRpc.mockReset().mockResolvedValue({ status: 'applied', version: 2, deletedAt: '2026-01-01T00:00:00Z', content: null });
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
});

describe('closet-outfit-week-plan dual-write regression (mandatory, Phase 3A4)', () => {
  it('assigning an empty day invokes ONLY the version-aware create path — legacy upsertClosetOutfitWeekPlanItemToBackend is never called', async () => {
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { assignClosetOutfitToWeekDay } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'business', OUTFIT);
    await reconcileClosetOutfitWeekPlan();

    expect(upsertClosetOutfitWeekPlanItemToBackend).toHaveBeenCalledTimes(0);
    expect(createClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
  });

  it('reassigning an already-assigned day invokes ONLY the version-aware update path — legacy upsert is never called', async () => {
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { assignClosetOutfitToWeekDay } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'business', OUTFIT);
    await reconcileClosetOutfitWeekPlan();
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([
      { dayKey, dayLabel: 'Monday', formality: 'business', outfit: OUTFIT, assignedAt: '2026-01-01T00:00:00Z', syncVersion: 1, deletedAt: null },
    ]);
    upsertClosetOutfitWeekPlanItemToBackend.mockClear();

    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'casual', OUTFIT);
    await reconcileClosetOutfitWeekPlan();

    expect(upsertClosetOutfitWeekPlanItemToBackend).toHaveBeenCalledTimes(0);
    expect(updateClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledTimes(1); // only the first, original assignment
  });

  it('clearing a day invokes ONLY the version-aware CAS delete path — legacy physical delete is never called', async () => {
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { assignClosetOutfitToWeekDay, removeClosetWeekPlanDay } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'business', OUTFIT);
    await reconcileClosetOutfitWeekPlan();
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([
      { dayKey, dayLabel: 'Monday', formality: 'business', outfit: OUTFIT, assignedAt: '2026-01-01T00:00:00Z', syncVersion: 1, deletedAt: null },
    ]);
    upsertClosetOutfitWeekPlanItemToBackend.mockClear();

    await removeClosetWeekPlanDay(dayKey);
    await reconcileClosetOutfitWeekPlan();

    expect(upsertClosetOutfitWeekPlanItemToBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemFromBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledWith(dayKey, 1);
  });

  it('across a full assign-then-clear lifecycle, the legacy week-plan-item architecture is invoked exactly zero times', async () => {
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { assignClosetOutfitToWeekDay, removeClosetWeekPlanDay } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'business', OUTFIT);
    await reconcileClosetOutfitWeekPlan();
    await removeClosetWeekPlanDay(dayKey);
    await reconcileClosetOutfitWeekPlan();

    expect(upsertClosetOutfitWeekPlanItemToBackend).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemFromBackend).not.toHaveBeenCalled();
  });
});

describe('all four domains: cross-domain dual-write isolation', () => {
  it('mutating closet-outfit-favourites never touches closet-outfit-week-plan RPCs and vice versa', async () => {
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { saveClosetOutfitToFavourites, assignClosetOutfitToWeekDay } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    await saveClosetOutfitToFavourites('business', OUTFIT);
    await reconcileClosetOutfitFavourites();
    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignClosetOutfitToWeekDay(dayKey, 'Monday', 'business', OUTFIT);
    await reconcileClosetOutfitWeekPlan();

    expect(createClosetOutfitFavouriteViaRpc).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(updateClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(deleteClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
  });
});
