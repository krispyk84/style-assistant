import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A4 (sync redesign) — proves lib/closet-outfit-week-plan-reconciliation.ts
// against REAL local storage (closet-outfit-storage + sync-metadata-storage,
// backed by the same in-memory FAILABLE AsyncStorage mock established in
// earlier phases) and a MOCKED backend-mediated HTTP layer
// (@/lib/closet-outfit-sync). This is the fourth and final domain: backend-
// mediated (like closet-outfit-favourites) AND slot/keyed (like ordinary
// week-plan) — combining both prior domains' load-bearing cases
// (UPDATE_SERVER/REACTIVATE_SERVER concurrency + HTTP-mediated CAS mapping)
// in one place, plus its own retention-window expiry concern.

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
  createSavedOutfitViaRpc: vi.fn(),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
  createWeekPlanItemViaRpc: vi.fn(),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

const createClosetOutfitWeekPlanItemViaRpc = vi.fn();
const updateClosetOutfitWeekPlanItemViaRpc = vi.fn();
const deleteClosetOutfitWeekPlanItemViaRpc = vi.fn();
const fetchClosetOutfitWeekPlanForReconciliation = vi.fn();
vi.mock('@/lib/closet-outfit-sync', () => ({
  createClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => createClosetOutfitWeekPlanItemViaRpc(...args),
  updateClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => updateClosetOutfitWeekPlanItemViaRpc(...args),
  deleteClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => deleteClosetOutfitWeekPlanItemViaRpc(...args),
  fetchClosetOutfitWeekPlanForReconciliation: () => fetchClosetOutfitWeekPlanForReconciliation(),
  // Inert stand-ins: reconciliation-adapters.ts imports these for the
  // now-fully-migrated favourites sibling adapter. Never invoked here.
  createClosetOutfitFavouriteViaRpc: vi.fn(),
  updateClosetOutfitFavouriteViaRpc: vi.fn(),
  deleteClosetOutfitFavouriteViaRpc: vi.fn(),
  fetchClosetOutfitFavouritesForReconciliation: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  getCurrentUserId.mockReset().mockResolvedValue('user-1');
  fetchClosetOutfitWeekPlanForReconciliation.mockReset().mockResolvedValue([]);
  createClosetOutfitWeekPlanItemViaRpc.mockReset();
  updateClosetOutfitWeekPlanItemViaRpc.mockReset();
  deleteClosetOutfitWeekPlanItemViaRpc.mockReset();
});

const OUTFIT = { id: 'outfit-1' } as unknown as import('@/types/api').ClosetGeneratedOutfit;

function item(dayKey: string, assignedAt = '2026-01-01T00:00:00Z') {
  return { dayKey, dayLabel: 'Monday', formality: 'business' as const, outfit: OUTFIT, assignedAt };
}

async function firstValidDayKey() {
  const { getNextSevenDays } = await import('@/lib/week-plan-storage');
  return getNextSevenDays()[0]!.dayKey;
}
async function secondValidDayKey() {
  const { getNextSevenDays } = await import('@/lib/week-plan-storage');
  return getNextSevenDays()[1]!.dayKey;
}

describe('reconcileClosetOutfitWeekPlan — 5. empty-day assignment (K2)', () => {
  it('a fresh day assignment with no server row is pushed via createClosetOutfitWeekPlanItemViaRpc', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await markActive('closet-outfit-week-plan', dayKey);
    createClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(createClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
    expect(createClosetOutfitWeekPlanItemViaRpc.mock.calls[0]![0]).toMatchObject({ dayKey });
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('if the server already has an assignment for the same day, never blindly overwrite — re-decide (content match -> lost-ack adopt)', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const local = item(dayKey);
    await writeOneClosetWeekPlanItemLocal(local);
    await markActive('closet-outfit-week-plan', dayKey);

    createClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'create_conflict', version: 3, deletedAt: null, content: local });
    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitWeekPlan — 6. normal reassignment (load-bearing UPDATE_SERVER case)', () => {
  it('a day previously acknowledged at version 8, reassigned locally, with server unchanged issues UPDATE_SERVER(baseVersion=8)', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const oldAssignment = item(dayKey);
    await writeOneClosetWeekPlanItemLocal(oldAssignment);
    await markActive('closet-outfit-week-plan', dayKey);
    await setLastSeenVersion('closet-outfit-week-plan', dayKey, 8);
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...oldAssignment, syncVersion: 8, deletedAt: null }]);

    const reassignment = { ...oldAssignment, formality: 'casual' as const, assignedAt: '2026-02-01T00:00:00Z' };
    await writeOneClosetWeekPlanItemLocal(reassignment);
    await markActive('closet-outfit-week-plan', dayKey);

    updateClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 9, deletedAt: null, content: null });
    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.objectContaining({ formality: 'casual' }), 8);
    expect(summary.success).toBe(1);
    expect(createClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 9, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitWeekPlan — 7/10. concurrent reassignment: clean -> ADOPT, dirty -> CONFLICT', () => {
  it('clean local (isDirty=false), server advanced to 9 -> ADOPT_SERVER, local content replaced', async () => {
    const { writeOneClosetWeekPlanItemLocal, readOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });

    const serverContent = { ...item(dayKey, '2026-03-01T00:00:00Z'), formality: 'casual' as const };
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...serverContent, syncVersion: 9, deletedAt: null }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 9, isDeleted: false, isDirty: false });
    expect((await readOneClosetWeekPlanItemLocal(dayKey))?.formality).toBe('casual');
  });

  it('dirty local (Device A\'s pending reassignment) against Device B\'s server advance to 9 -> CONFLICT, both sides preserved, other days unaffected', async () => {
    const { writeOneClosetWeekPlanItemLocal, readOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    const deviceALocal = { ...item(dayKey), formality: 'smart-casual' as const };
    await writeOneClosetWeekPlanItemLocal(deviceALocal);
    await markActive('closet-outfit-week-plan', dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey, '2026-03-01T00:00:00Z'), formality: 'casual', syncVersion: 9, deletedAt: null }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    expect((await readOneClosetWeekPlanItemLocal(dayKey))?.formality).toBe('smart-casual');
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 8, isDeleted: false, isDirty: true });
  });
});

describe('reconcileClosetOutfitWeekPlan — 8. clear vs. server reassign (Case G)', () => {
  it('clearing locally from version 8 while the server moved to 9 is a CONFLICT — server version 9 is never deleted', async () => {
    const { removeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    await markDeleted('closet-outfit-week-plan', dayKey);
    await removeOneClosetWeekPlanItemLocal(dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 9, deletedAt: null }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(deleteClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 8, isDeleted: true, isDirty: true });
  });
});

describe('reconcileClosetOutfitWeekPlan — 9. local reassign vs. server clear', () => {
  it('reassigning locally from version 8 while the server is now a tombstone @9 is a CONFLICT — neither side auto-restored/deleted/reactivated', async () => {
    const { writeOneClosetWeekPlanItemLocal, readOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    const localReassignment = { ...item(dayKey), formality: 'smart-casual' as const };
    await writeOneClosetWeekPlanItemLocal(localReassignment);
    await markActive('closet-outfit-week-plan', dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 9, deletedAt: '2026-04-01T00:00:00Z' }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect((await readOneClosetWeekPlanItemLocal(dayKey))?.formality).toBe('smart-casual');
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 8, isDeleted: false, isDirty: true });
  });
});

describe('reconcileClosetOutfitWeekPlan — 11. reactivation', () => {
  it('assigning a day whose tombstone was already acknowledged issues REACTIVATE_SERVER(baseVersion)', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 9, isDeleted: true, isDirty: false });
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 9, deletedAt: '2026-01-01T00:00:00Z' }]);

    await writeOneClosetWeekPlanItemLocal(item(dayKey, '2026-05-01T00:00:00Z'));
    await markActive('closet-outfit-week-plan', dayKey);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 9, isDeleted: false, isDirty: true });

    updateClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 10, deletedAt: null, content: null });
    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.anything(), 9);
    expect(summary.success).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 10, isDeleted: false, isDirty: false });
  });

  it('server advanced past the tombstone before local reactivation reaches it -> conflict, never a force-write', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 9, isDeleted: true, isDirty: false });
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 11, deletedAt: null }]);

    await writeOneClosetWeekPlanItemLocal(item(dayKey, '2026-05-01T00:00:00Z'));
    await markActive('closet-outfit-week-plan', dayKey);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
  });
});

describe('reconcileClosetOutfitWeekPlan — 12/13. lost-ack recovery: update AND delete', () => {
  it('update: stale-baseVersion retry whose server content matches (differing only in assignedAt) is recognized as lost-ack success', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    const local = { ...item(dayKey), assignedAt: '2026-06-01T00:00:00Z' };
    await writeOneClosetWeekPlanItemLocal(local);
    await markActive('closet-outfit-week-plan', dayKey);

    // Server read still shows the stale version 8 — the CAS RPC itself
    // discovers, via its own response, that this device's earlier write
    // already succeeded (now @9) but the ack was lost.
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...local, syncVersion: 8, deletedAt: null }]);
    updateClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({
      status: 'conflict', version: 9, deletedAt: null, content: { ...local, assignedAt: '2026-06-01T00:05:00Z' },
    });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(updateClosetOutfitWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.anything(), 8);
    expect(summary.success).toBe(1);
    expect(summary.conflicts).toBe(0);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 9, isDeleted: false, isDirty: false });
  });

  it('update: stale-baseVersion retry whose server content is genuinely DIFFERENT remains a real CONFLICT', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    const local = { ...item(dayKey), formality: 'business' as const };
    await writeOneClosetWeekPlanItemLocal(local);
    await markActive('closet-outfit-week-plan', dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...local, syncVersion: 8, deletedAt: null }]);
    updateClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({
      status: 'conflict', version: 9, deletedAt: null, content: { ...local, formality: 'casual' },
    });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 8, isDeleted: false, isDirty: true });
  });

  it('delete: a stale-conflict response that IS a real tombstone (deletedAt !== null) is recognized as the achieved delete goal', async () => {
    const { writeOneClosetWeekPlanItemLocal, removeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await markDeleted('closet-outfit-week-plan', dayKey);
    await removeOneClosetWeekPlanItemLocal(dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 8, deletedAt: null }]);
    deleteClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'conflict', version: 9, deletedAt: '2026-07-01T00:00:00Z', content: null });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.success).toBe(1);
    expect(summary.conflicts).toBe(0);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 9, isDeleted: true, isDirty: false });
  });

  it('MANDATORY (Phase 3A4 §13): delete — a stale-conflict response that is still ACTIVE (deletedAt: null), even with IDENTICAL content, is NEVER treated as an achieved deletion; remains CONFLICT', async () => {
    const { writeOneClosetWeekPlanItemLocal, removeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markDeleted, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const content = item(dayKey);
    await applyMetadataPatch('closet-outfit-week-plan', dayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    await writeOneClosetWeekPlanItemLocal(content);
    await markDeleted('closet-outfit-week-plan', dayKey);
    await removeOneClosetWeekPlanItemLocal(dayKey);

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...content, syncVersion: 8, deletedAt: null }]);
    // Server reports the row is still ACTIVE with content IDENTICAL to what
    // was being deleted — must NOT be accepted as a successful deletion.
    deleteClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'conflict', version: 9, deletedAt: null, content });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.conflicts).toBe(1);
    expect(summary.success).toBe(0);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 8, isDeleted: true, isDirty: true });
  });
});

describe('reconcileClosetOutfitWeekPlan — 15/16. rollover expiry + dirty-expired-id handling', () => {
  it('an expired day with active metadata and an active server row is skipped entirely, never re-materialized, and its stale (non-dirty) metadata is cleaned up', async () => {
    const { applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { readOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const expiredDayKey = '2020-01-01'; // always outside any real retention window
    await applyMetadataPatch('closet-outfit-week-plan', expiredDayKey, { lastSeenVersion: 3, isDeleted: false, isDirty: false });
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(expiredDayKey), syncVersion: 3, deletedAt: null }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.considered).toBe(0);
    expect(createClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(await readOneClosetWeekPlanItemLocal(expiredDayKey)).toBeNull();
    expect(await getMetadata('closet-outfit-week-plan', expiredDayKey)).toBeNull();
  });

  it('an expired day that is still DIRTY (an unresolved conflict/unsynced intent) is likewise skipped and its metadata cleaned up — no destructive write is ever issued for it', async () => {
    const { applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const expiredDayKey = '2020-06-15';
    // A day that expired while still dirty (e.g. an unresolved conflict, or
    // a create/update that never got a chance to sync before rolling over).
    await applyMetadataPatch('closet-outfit-week-plan', expiredDayKey, { lastSeenVersion: 8, isDeleted: false, isDirty: true });
    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([{ ...item(expiredDayKey), syncVersion: 9, deletedAt: null }]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.considered).toBe(0);
    expect(summary.dirtyRemaining).toBe(0); // excluded entirely — not counted as dirty-remaining either
    expect(createClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(updateClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(deleteClosetOutfitWeekPlanItemViaRpc).not.toHaveBeenCalled();
    // Metadata cleaned up even though it was dirty — an expired day can
    // never re-enter the reconciliation scope on this device again (the
    // window only moves forward), so there is no future pass that could
    // ever act on this pending intent regardless of whether it survives.
    expect(await getMetadata('closet-outfit-week-plan', expiredDayKey)).toBeNull();
  });

  it('a genuine local write for a day still inside the window is unaffected by the retention filter', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await markActive('closet-outfit-week-plan', dayKey);
    createClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.considered).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitWeekPlan — 21. one conflicted day does not block others', () => {
  it('a conflicting day and a clean-newer day in the same batch are each decided independently', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const conflictDay = await firstValidDayKey();
    const cleanDay = await secondValidDayKey();

    await applyMetadataPatch('closet-outfit-week-plan', conflictDay, { lastSeenVersion: 8, isDeleted: false, isDirty: false });
    await writeOneClosetWeekPlanItemLocal({ ...item(conflictDay), formality: 'smart-casual' as const });
    await markActive('closet-outfit-week-plan', conflictDay);

    await writeOneClosetWeekPlanItemLocal(item(cleanDay));
    await applyMetadataPatch('closet-outfit-week-plan', cleanDay, { lastSeenVersion: 1, isDeleted: false, isDirty: false });

    fetchClosetOutfitWeekPlanForReconciliation.mockResolvedValue([
      { ...item(conflictDay), formality: 'casual', syncVersion: 9, deletedAt: null },
      { ...item(cleanDay), formality: 'casual', syncVersion: 2, deletedAt: null },
    ]);

    const summary = await reconcileClosetOutfitWeekPlan();

    expect(summary.considered).toBe(2);
    expect(summary.conflicts).toBe(1);
    expect(summary.success).toBe(1);
    expect((await getMetadata('closet-outfit-week-plan', conflictDay))?.isDirty).toBe(true);
    expect(await getMetadata('closet-outfit-week-plan', cleanDay)).toEqual({ lastSeenVersion: 2, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitWeekPlan — 14/network-failure recovery', () => {
  it('a reassignment that fails while the backend is unavailable leaves isDirty=true; a later successful pass converges it', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await markActive('closet-outfit-week-plan', dayKey);

    createClosetOutfitWeekPlanItemViaRpc.mockRejectedValue(new Error('backend unavailable'));
    const firstAttempt = await reconcileClosetOutfitWeekPlan();
    expect(firstAttempt.operationalFailures).toBe(1);
    expect((await getMetadata('closet-outfit-week-plan', dayKey))?.isDirty).toBe(true);

    createClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    const secondAttempt = await reconcileClosetOutfitWeekPlan();
    expect(secondAttempt.success).toBe(1);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('reconcileClosetOutfitWeekPlan — 20. single-flight coalescing', () => {
  it('a caller arriving mid-run is coalesced into exactly one follow-up run and never joins the stale in-flight snapshot', async () => {
    const { writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    let releaseFirstFetch: (() => void) | null = null;
    const firstFetchGate = new Promise<void>((resolve) => { releaseFirstFetch = resolve; });
    let fetchCallCount = 0;
    fetchClosetOutfitWeekPlanForReconciliation.mockImplementation(async () => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) await firstFetchGate;
      return [];
    });
    createClosetOutfitWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const run1 = reconcileClosetOutfitWeekPlan();

    const dayKey = await firstValidDayKey();
    await writeOneClosetWeekPlanItemLocal(item(dayKey));
    await markActive('closet-outfit-week-plan', dayKey);
    const run2 = reconcileClosetOutfitWeekPlan();
    const run3 = reconcileClosetOutfitWeekPlan();

    releaseFirstFetch!();
    await Promise.all([run1, run2, run3]);

    expect(fetchCallCount).toBe(2);
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});
