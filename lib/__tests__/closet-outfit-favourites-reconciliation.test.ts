import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A3 (sync redesign) — proves lib/closet-outfit-favourites-reconciliation.ts
// against REAL local storage (closet-outfit-storage + sync-metadata-storage,
// backed by the same in-memory FAILABLE AsyncStorage mock established in
// earlier phases) and a MOCKED backend-mediated HTTP layer
// (@/lib/closet-outfit-sync). This is the first domain mediated through our
// own backend (authenticated HTTP -> service -> Prisma) rather than direct
// Supabase RPCs — the point of this file is proving the HTTP-mediated
// adapter maps onto the exact same executor semantics already proven for
// direct Supabase, not re-testing the engine/executor themselves.

const storageMock = new Map<string, string>();
const failingKeys = new Set<string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      return Promise.resolve(storageMock.get(key) ?? null);
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      storageMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      storageMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

vi.mock('@/lib/crashlytics', () => ({ recordError: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/api/api-client', () => ({ createApiClient: vi.fn() }));

const getCurrentUserId = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserId(),
  // Inert stand-ins: reconciliation-adapters.ts imports these for the
  // direct-Supabase domains' adapters at module load time. Never invoked here.
  createSavedOutfitViaRpc: vi.fn(),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
  createWeekPlanItemViaRpc: vi.fn(),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

const createClosetOutfitFavouriteViaRpc = vi.fn();
const updateClosetOutfitFavouriteViaRpc = vi.fn();
const deleteClosetOutfitFavouriteViaRpc = vi.fn();
const fetchClosetOutfitFavouritesForReconciliation = vi.fn();
vi.mock('@/lib/closet-outfit-sync', () => ({
  createClosetOutfitFavouriteViaRpc: (...args: unknown[]) => createClosetOutfitFavouriteViaRpc(...args),
  updateClosetOutfitFavouriteViaRpc: (...args: unknown[]) => updateClosetOutfitFavouriteViaRpc(...args),
  deleteClosetOutfitFavouriteViaRpc: (...args: unknown[]) => deleteClosetOutfitFavouriteViaRpc(...args),
  fetchClosetOutfitFavouritesForReconciliation: () => fetchClosetOutfitFavouritesForReconciliation(),
  // Inert stand-ins: reconciliation-adapters.ts imports these for the
  // untouched closet-outfit-week-plan sibling adapter. Never invoked here.
  createClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  updateClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  deleteClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  // closet-outfit-storage.ts's own (untouched) week-plan-item legacy calls —
  // not exercised by these tests, but must resolve to something callable.
  upsertClosetOutfitWeekPlanItemToBackend: vi.fn().mockResolvedValue(undefined),
  deleteClosetOutfitWeekPlanItemFromBackend: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  getCurrentUserId.mockReset().mockResolvedValue('user-1');
  fetchClosetOutfitFavouritesForReconciliation.mockReset().mockResolvedValue([]);
  createClosetOutfitFavouriteViaRpc.mockReset();
  updateClosetOutfitFavouriteViaRpc.mockReset();
  deleteClosetOutfitFavouriteViaRpc.mockReset();
});

const OUTFIT = { id: 'outfit-1' } as unknown as import('@/types/api').ClosetGeneratedOutfit;

function favourite(id: string, savedAt = '2026-01-01T00:00:00Z') {
  return { id, formality: 'business' as const, outfit: OUTFIT, savedAt };
}

describe('reconcileClosetOutfitFavourites — 8. K2 (known local creation)', () => {
  it('a fresh local favourite with no server row is pushed via createClosetOutfitFavouriteViaRpc', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f1'));
    await markActive('closet-outfit-favourites', 'f1');
    createClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const summary = await reconcileClosetOutfitFavourites();

    expect(createClosetOutfitFavouriteViaRpc).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitFavouriteViaRpc.mock.calls[0]![0]).toMatchObject({ id: 'f1' });
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f1')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitFavourites — 7. K1 (unknown-ancestry legacy state)', () => {
  it('a local favourite with NO sync metadata and server absent is deferred, never auto-created — distinguished from K2 above', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('legacy-f1'));

    const summary = await reconcileClosetOutfitFavourites();

    expect(createClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(summary.deferred).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'legacy-f1')).toBeNull();
  });
});

describe('reconcileClosetOutfitFavourites — 5. existing-user bootstrap (equal vs. unequal)', () => {
  it('local present, no metadata, server active with EQUAL content -> ADOPT_SERVER, no mutation', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    // Differs only in savedAt — excluded from equality (Phase 2B2's rule).
    await writeOneSavedClosetOutfitLocal(favourite('f2', '2026-01-01T00:00:00Z'));
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...favourite('f2', '2026-02-01T00:00:00Z'), syncVersion: 3, deletedAt: null }]);

    const summary = await reconcileClosetOutfitFavourites();

    expect(createClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(updateClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f2')).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
  });

  it('local present, no metadata, server active with DIFFERENT content -> CONFLICT, neither side silently chosen', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f3'));
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([
      { id: 'f3', formality: 'casual', outfit: OUTFIT, savedAt: '2026-01-01T00:00:00Z', syncVersion: 2, deletedAt: null },
    ]);

    const summary = await reconcileClosetOutfitFavourites();

    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f3')).toBeNull();
  });
});

describe('reconcileClosetOutfitFavourites — 9/10. unfavourite CAS + stale-unfavourite conflict', () => {
  it('unfavouriting an acknowledged favourite issues DELETE_SERVER(baseVersion) when the server is unchanged, and never invokes the legacy delete', async () => {
    const { writeOneSavedClosetOutfitLocal, removeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f4'));
    await setLastSeenVersion('closet-outfit-favourites', 'f4', 4);
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...favourite('f4'), syncVersion: 4, deletedAt: null }]);

    await markDeleted('closet-outfit-favourites', 'f4');
    await removeOneSavedClosetOutfitLocal('f4');

    deleteClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'applied', version: 5, deletedAt: '2026-03-01T00:00:00Z', content: null });
    const summary = await reconcileClosetOutfitFavourites();

    expect(deleteClosetOutfitFavouriteViaRpc).toHaveBeenCalledWith('f4', 4);
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f4')).toEqual({ lastSeenVersion: 5, isDeleted: true, isDirty: false });
  });

  it('Case G: unfavouriting from a stale baseVersion while the server advanced to N+1 is a CONFLICT — never deletes the newer server row, never auto-advances baseVersion', async () => {
    const { writeOneSavedClosetOutfitLocal, removeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f5'));
    await setLastSeenVersion('closet-outfit-favourites', 'f5', 4);
    await markDeleted('closet-outfit-favourites', 'f5');
    await removeOneSavedClosetOutfitLocal('f5');

    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...favourite('f5'), syncVersion: 5, deletedAt: null }]);

    const summary = await reconcileClosetOutfitFavourites();

    expect(deleteClosetOutfitFavouriteViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f5')).toEqual({ lastSeenVersion: 4, isDeleted: true, isDirty: true });
  });
});

describe('reconcileClosetOutfitFavourites — 12. re-favourite / reactivation (same-id reuse)', () => {
  it('favouriting the same outfit id again after its tombstone was acknowledged issues REACTIVATE_SERVER(baseVersion)', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    // Acknowledged tombstone, settled.
    await applyMetadataPatch('closet-outfit-favourites', 'f6', { lastSeenVersion: 5, isDeleted: true, isDirty: false });
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...favourite('f6'), syncVersion: 5, deletedAt: '2026-01-01T00:00:00Z' }]);

    // The outfit-builder's deterministic id formula reproduces the same id
    // on re-favourite (Phase 3A3 §1 finding) — the user favourites it again.
    await writeOneSavedClosetOutfitLocal(favourite('f6', '2026-04-01T00:00:00Z'));
    await markActive('closet-outfit-favourites', 'f6');
    expect(await getMetadata('closet-outfit-favourites', 'f6')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: true });

    updateClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'applied', version: 6, deletedAt: null, content: null });
    const summary = await reconcileClosetOutfitFavourites();

    expect(updateClosetOutfitFavouriteViaRpc).toHaveBeenCalledWith(expect.anything(), 5);
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f6')).toEqual({ lastSeenVersion: 6, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitFavourites — 13/14. lost-acknowledgement recovery vs. genuine stale conflict', () => {
  it('create: create_conflict whose returned content matches local is recognized as a lost-ack success, not a foreign conflict', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    const local = favourite('f7');
    await writeOneSavedClosetOutfitLocal(local);
    await markActive('closet-outfit-favourites', 'f7');

    createClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'create_conflict', version: 2, deletedAt: null, content: local });
    const summary = await reconcileClosetOutfitFavourites();

    expect(summary.success).toBe(1);
    expect(summary.conflicts).toBe(0);
    expect(await getMetadata('closet-outfit-favourites', 'f7')).toEqual({ lastSeenVersion: 2, isDeleted: false, isDirty: false });
  });

  it('delete: a stale-baseVersion retry whose server already shows the tombstone is recognized as this device\'s own achieved goal, not a foreign conflict', async () => {
    const { writeOneSavedClosetOutfitLocal, removeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f8'));
    await setLastSeenVersion('closet-outfit-favourites', 'f8', 4);
    await markDeleted('closet-outfit-favourites', 'f8');
    await removeOneSavedClosetOutfitLocal('f8');

    // Server read shows the row still active @4 (this device's own earlier
    // delete attempt already applied server-side, but the ack never landed).
    fetchClosetOutfitFavouritesForReconciliation.mockResolvedValue([{ ...favourite('f8'), syncVersion: 4, deletedAt: null }]);
    deleteClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'conflict', version: 5, deletedAt: '2026-05-01T00:00:00Z', content: null });

    const summary = await reconcileClosetOutfitFavourites();

    expect(summary.success).toBe(1);
    expect(summary.conflicts).toBe(0);
    expect(await getMetadata('closet-outfit-favourites', 'f8')).toEqual({ lastSeenVersion: 5, isDeleted: true, isDirty: false });
  });

  it('genuinely different create_conflict content under the same id is a real, unresolved collision', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f9'));
    await markActive('closet-outfit-favourites', 'f9');

    createClosetOutfitFavouriteViaRpc.mockResolvedValue({
      status: 'create_conflict', version: 2, deletedAt: null,
      content: { id: 'f9', formality: 'casual', outfit: OUTFIT, savedAt: '2020-01-01T00:00:00Z' },
    });
    const summary = await reconcileClosetOutfitFavourites();

    expect(summary.conflicts).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f9')).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });
});

describe('reconcileClosetOutfitFavourites — 20. per-record isolation', () => {
  it('one favourite failing does not stop another in the same batch', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('ok-1'));
    await markActive('closet-outfit-favourites', 'ok-1');
    await writeOneSavedClosetOutfitLocal(favourite('bad-1'));
    await markActive('closet-outfit-favourites', 'bad-1');

    createClosetOutfitFavouriteViaRpc.mockImplementation((item: { id: string }) => {
      if (item.id === 'bad-1') return Promise.reject(new Error('backend unavailable'));
      return Promise.resolve({ status: 'created', version: 1, deletedAt: null, content: null });
    });

    const summary = await reconcileClosetOutfitFavourites();

    expect(summary.considered).toBe(2);
    expect(summary.success).toBe(1);
    expect(summary.operationalFailures).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'ok-1')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
    expect((await getMetadata('closet-outfit-favourites', 'bad-1'))?.isDirty).toBe(true);
  });
});

describe('reconcileClosetOutfitFavourites — 3/4. network failure + restart/retry', () => {
  it('a favourite that fails to sync while the backend is unavailable leaves isDirty=true; a later successful pass converges it', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    await writeOneSavedClosetOutfitLocal(favourite('f10'));
    await markActive('closet-outfit-favourites', 'f10');

    createClosetOutfitFavouriteViaRpc.mockRejectedValue(new Error('network error'));
    const firstAttempt = await reconcileClosetOutfitFavourites();
    expect(firstAttempt.operationalFailures).toBe(1);
    expect((await getMetadata('closet-outfit-favourites', 'f10'))?.isDirty).toBe(true);

    createClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    const secondAttempt = await reconcileClosetOutfitFavourites();
    expect(secondAttempt.success).toBe(1);
    expect(await getMetadata('closet-outfit-favourites', 'f10')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitFavourites — 19. single-flight coalescing', () => {
  it('a caller arriving mid-run is coalesced into exactly one follow-up run and never joins the stale in-flight snapshot', async () => {
    const { writeOneSavedClosetOutfitLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');

    let releaseFirstFetch: (() => void) | null = null;
    const firstFetchGate = new Promise<void>((resolve) => { releaseFirstFetch = resolve; });
    let fetchCallCount = 0;
    fetchClosetOutfitFavouritesForReconciliation.mockImplementation(async () => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) await firstFetchGate;
      return [];
    });
    createClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const run1 = reconcileClosetOutfitFavourites();

    await writeOneSavedClosetOutfitLocal(favourite('f11'));
    await markActive('closet-outfit-favourites', 'f11');
    const run2 = reconcileClosetOutfitFavourites();
    const run3 = reconcileClosetOutfitFavourites();

    releaseFirstFetch!();
    await Promise.all([run1, run2, run3]);

    expect(fetchCallCount).toBe(2);
    expect(await getMetadata('closet-outfit-favourites', 'f11')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});
