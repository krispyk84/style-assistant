import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A2 (sync redesign) — proves lib/week-plan-reconciliation.ts against
// REAL local storage (week-plan-storage + sync-metadata-storage, backed by
// the same in-memory FAILABLE AsyncStorage mock established in earlier
// phases) and a MOCKED Supabase RPC layer (@/lib/supabase-data). Week-plan
// is slot/keyed state — unlike saved-outfits' document-like create/delete
// only shape, reassigning an already-synced day is a normal, reachable
// action, so this file exercises UPDATE_SERVER/REACTIVATE_SERVER and real
// concurrent-slot-conflict behavior that saved-outfits-reconciliation.test.ts
// never needed to.

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
const fetchWeekPlanForReconciliation = vi.fn();
const createWeekPlanItemViaRpc = vi.fn();
const updateWeekPlanItemViaRpc = vi.fn();
const deleteWeekPlanItemViaRpc = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserId(),
  fetchWeekPlanForReconciliation: () => fetchWeekPlanForReconciliation(),
  createWeekPlanItemViaRpc: (...args: unknown[]) => createWeekPlanItemViaRpc(...args),
  updateWeekPlanItemViaRpc: (...args: unknown[]) => updateWeekPlanItemViaRpc(...args),
  deleteWeekPlanItemViaRpc: (...args: unknown[]) => deleteWeekPlanItemViaRpc(...args),
  // Inert stand-ins: reconciliation-adapters.ts imports these for the OTHER
  // three domains' adapters at module load time. Never invoked here.
  createSavedOutfitViaRpc: vi.fn(),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  getCurrentUserId.mockReset().mockResolvedValue('user-1');
  fetchWeekPlanForReconciliation.mockReset().mockResolvedValue([]);
  createWeekPlanItemViaRpc.mockReset();
  updateWeekPlanItemViaRpc.mockReset();
  deleteWeekPlanItemViaRpc.mockReset();
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

async function firstValidDayKey() {
  const { getNextSevenDays } = await import('@/lib/week-plan-storage');
  return getNextSevenDays()[0]!.dayKey;
}
async function secondValidDayKey() {
  const { getNextSevenDays } = await import('@/lib/week-plan-storage');
  return getNextSevenDays()[1]!.dayKey;
}

function item(dayKey: string, assignedAt = '2026-01-01T00:00:00Z') {
  return { dayKey, dayLabel: 'Monday', requestId: 'req-1', assignedAt, input: INPUT, recommendation: RECOMMENDATION };
}

describe('reconcileWeekPlan — 1. new empty-day assignment (K2)', () => {
  it('a fresh day assignment with no server row is pushed via createWeekPlanItemViaRpc', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneWeekPlanItemLocal(item(dayKey));
    await markActive('week-plan', dayKey);

    createWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    const summary = await reconcileWeekPlan();

    expect(createWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
    expect(createWeekPlanItemViaRpc.mock.calls[0]![0]).toMatchObject({ dayKey });
    expect(summary.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('if the server already has an assignment for the same day, never blindly overwrite it — re-decide (content match -> adopt as lost-ack; mismatch -> conflict)', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const local = item(dayKey);
    await writeOneWeekPlanItemLocal(local);
    await markActive('week-plan', dayKey);

    createWeekPlanItemViaRpc.mockResolvedValue({ status: 'create_conflict', version: 3, deletedAt: null, content: local });
    const summary = await reconcileWeekPlan();

    expect(summary.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
  });
});

describe('reconcileWeekPlan — 2. normal reassignment (load-bearing UPDATE_SERVER case)', () => {
  it('a day previously acknowledged at version 4, reassigned locally, with server unchanged issues UPDATE_SERVER(baseVersion=4)', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const oldAssignment = item(dayKey);
    await writeOneWeekPlanItemLocal(oldAssignment);
    await markActive('week-plan', dayKey);
    await setLastSeenVersion('week-plan', dayKey, 4);
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...oldAssignment, syncVersion: 4, deletedAt: null }]);

    // User reassigns a different outfit to the same day.
    const reassignment = { ...oldAssignment, requestId: 'req-2', assignedAt: '2026-02-01T00:00:00Z' };
    await writeOneWeekPlanItemLocal(reassignment);
    await markActive('week-plan', dayKey);

    updateWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 5, deletedAt: null, content: null });
    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-2' }), 4);
    expect(summary.success).toBe(1);
    // No new server row was created for this day — same logical identity.
    expect(createWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
  });
});

describe('reconcileWeekPlan — 3. user clear', () => {
  it('clearing an acknowledged day issues DELETE_SERVER(baseVersion) when the server is unchanged', async () => {
    const { writeOneWeekPlanItemLocal, removeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    const assignment = item(dayKey);
    await writeOneWeekPlanItemLocal(assignment);
    await markActive('week-plan', dayKey);
    await setLastSeenVersion('week-plan', dayKey, 4);
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...assignment, syncVersion: 4, deletedAt: null }]);

    await markDeleted('week-plan', dayKey);
    await removeOneWeekPlanItemLocal(dayKey);

    deleteWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 5, deletedAt: '2026-03-01T00:00:00Z', content: null });
    const summary = await reconcileWeekPlan();

    expect(deleteWeekPlanItemViaRpc).toHaveBeenCalledWith(dayKey, 4);
    expect(summary.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: true, isDirty: false });
  });
});

describe('reconcileWeekPlan — 4. reactivation', () => {
  it('assigning a new outfit to a day whose tombstone was already acknowledged issues REACTIVATE_SERVER(baseVersion)', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    // Monday was acknowledged as tombstone @ 5, settled (not dirty).
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 5, isDeleted: true, isDirty: false });
    fetchWeekPlanForReconciliation.mockResolvedValue([
      { ...item(dayKey), syncVersion: 5, deletedAt: '2026-01-01T00:00:00Z' },
    ]);

    // User assigns an outfit to Monday again.
    const reassignment = item(dayKey, '2026-04-01T00:00:00Z');
    await writeOneWeekPlanItemLocal(reassignment);
    await markActive('week-plan', dayKey);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: true });

    updateWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 6, deletedAt: null, content: null });
    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.anything(), 5);
    expect(summary.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 6, isDeleted: false, isDirty: false });
  });

  it('if the server advanced past the tombstone before local reactivation reaches it, this is a stale-baseVersion conflict, never a force-write', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 5, isDeleted: true, isDirty: false });
    // Someone else reactivated/changed the row after our tombstone, unbeknownst to us.
    fetchWeekPlanForReconciliation.mockResolvedValue([
      { ...item(dayKey, '2026-05-01T00:00:00Z', ), syncVersion: 7, deletedAt: null },
    ]);

    await writeOneWeekPlanItemLocal(item(dayKey, '2026-04-01T00:00:00Z'));
    await markActive('week-plan', dayKey);

    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: true });
  });
});

describe('reconcileWeekPlan — 5/6. same server advance: clean -> ADOPT, dirty -> CONFLICT', () => {
  it('clean local (isDirty=false), server advanced to 5 -> ADOPT_SERVER, local content replaced, metadata acknowledges v5', async () => {
    const { writeOneWeekPlanItemLocal, readOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneWeekPlanItemLocal(item(dayKey));
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });

    const serverContent = { ...item(dayKey, '2026-06-01T00:00:00Z'), requestId: 'req-server' };
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...serverContent, syncVersion: 5, deletedAt: null }]);

    const summary = await reconcileWeekPlan();

    expect(summary.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
    expect((await readOneWeekPlanItemLocal(dayKey))?.requestId).toBe('req-server');
  });

  it('dirty local (pending reassignment) against the exact same server advance to 5 -> CONFLICT, never silently overwritten', async () => {
    const { writeOneWeekPlanItemLocal, readOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    await writeOneWeekPlanItemLocal(item(dayKey));
    // Local reassignment from the version-4 baseline.
    const localReassignment = { ...item(dayKey), requestId: 'req-local' };
    await writeOneWeekPlanItemLocal(localReassignment);
    await markActive('week-plan', dayKey);

    const serverContent = { ...item(dayKey, '2026-06-01T00:00:00Z'), requestId: 'req-server-b' };
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...serverContent, syncVersion: 5, deletedAt: null }]);

    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    // Both sides preserved: local still shows the local reassignment, metadata unchanged.
    expect((await readOneWeekPlanItemLocal(dayKey))?.requestId).toBe('req-local');
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 4, isDeleted: false, isDirty: true });
  });
});

describe('reconcileWeekPlan — 7. local clear vs. server reassignment (Case G)', () => {
  it('clearing locally from version 4 while the server has moved to 5 is a CONFLICT — server version 5 is never deleted', async () => {
    const { removeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markDeleted, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    await markDeleted('week-plan', dayKey);
    await removeOneWeekPlanItemLocal(dayKey);

    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 5, deletedAt: null }]);

    const summary = await reconcileWeekPlan();

    expect(deleteWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 4, isDeleted: true, isDirty: true });
  });
});

describe('reconcileWeekPlan — 8. local reassignment vs. server clear', () => {
  it('reassigning locally from version 4 while the server has been cleared to a tombstone @5 is a CONFLICT — neither side is silently restored, deleted, or reactivated', async () => {
    const { writeOneWeekPlanItemLocal, readOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    const localReassignment = { ...item(dayKey), requestId: 'req-local-reassign' };
    await writeOneWeekPlanItemLocal(localReassignment);
    await markActive('week-plan', dayKey);

    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 5, deletedAt: '2026-07-01T00:00:00Z' }]);

    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(deleteWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect((await readOneWeekPlanItemLocal(dayKey))?.requestId).toBe('req-local-reassign');
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 4, isDeleted: false, isDirty: true });
  });
});

describe('reconcileWeekPlan — 9/10. lost-acknowledgement recovery vs. genuine stale update', () => {
  it('a stale-baseVersion retry whose server content matches the intended local assignment (differing only in assignedAt) is recognized as this device\'s own earlier success', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    const local = { ...item(dayKey), assignedAt: '2026-08-01T00:00:00Z' };
    await writeOneWeekPlanItemLocal(local);
    await markActive('week-plan', dayKey); // local dirty from version-4 baseline

    // The CAS reassignment actually succeeded server-side (now @5) with the
    // same semantic assignment but a different assignedAt (the server
    // recorded its own write time) — the ack was lost before metadata
    // updated. updateWeekPlanItemViaRpc's own response reports this.
    // The reconciliation READ itself still shows the stale version 4 (this
    // device's last acknowledged state) — the staleness is only discovered
    // when the CAS RPC actually runs and reports the row already moved.
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...local, syncVersion: 4, deletedAt: null }]);
    updateWeekPlanItemViaRpc.mockResolvedValue({
      status: 'conflict',
      version: 5,
      deletedAt: null,
      content: { ...local, assignedAt: '2026-08-01T00:05:00Z' },
    });

    const summary = await reconcileWeekPlan();

    expect(updateWeekPlanItemViaRpc).toHaveBeenCalledWith(expect.anything(), 4);
    expect(summary.success).toBe(1);
    expect(summary.conflicts).toBe(0);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
  });

  it('a stale-baseVersion retry whose server content is a genuinely DIFFERENT assignment remains a real CONFLICT', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    const local = { ...item(dayKey), requestId: 'req-mine' };
    await writeOneWeekPlanItemLocal(local);
    await markActive('week-plan', dayKey);

    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...local, syncVersion: 4, deletedAt: null }]);
    updateWeekPlanItemViaRpc.mockResolvedValue({
      status: 'conflict',
      version: 5,
      deletedAt: null,
      content: { ...local, requestId: 'req-someone-elses' },
    });

    const summary = await reconcileWeekPlan();

    expect(summary.conflicts).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 4, isDeleted: false, isDirty: true });
  });
});

describe('reconcileWeekPlan — 11. network failure + restart/retry', () => {
  it('a reassignment that fails while offline leaves isDirty=true; a later successful pass converges it', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await applyMetadataPatch('week-plan', dayKey, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    await writeOneWeekPlanItemLocal({ ...item(dayKey), requestId: 'req-retry' });
    await markActive('week-plan', dayKey);
    fetchWeekPlanForReconciliation.mockResolvedValue([{ ...item(dayKey), syncVersion: 4, deletedAt: null }]);

    updateWeekPlanItemViaRpc.mockRejectedValue(new Error('offline'));
    const firstAttempt = await reconcileWeekPlan();
    expect(firstAttempt.operationalFailures).toBe(1);
    expect((await getMetadata('week-plan', dayKey))?.isDirty).toBe(true);

    updateWeekPlanItemViaRpc.mockResolvedValue({ status: 'applied', version: 5, deletedAt: null, content: null });
    const secondAttempt = await reconcileWeekPlan();
    expect(secondAttempt.success).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
  });
});

describe('reconcileWeekPlan — 12. single-flight coalescing', () => {
  it('a caller arriving mid-run is coalesced into exactly one follow-up run and never joins the stale in-flight snapshot', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    let releaseFirstFetch: (() => void) | null = null;
    const firstFetchGate = new Promise<void>((resolve) => { releaseFirstFetch = resolve; });
    let fetchCallCount = 0;
    fetchWeekPlanForReconciliation.mockImplementation(async () => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) await firstFetchGate;
      return [];
    });
    createWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const run1 = reconcileWeekPlan();

    const dayKey = await firstValidDayKey();
    await writeOneWeekPlanItemLocal(item(dayKey));
    await markActive('week-plan', dayKey);
    const run2 = reconcileWeekPlan();
    const run3 = reconcileWeekPlan();

    releaseFirstFetch!();
    await Promise.all([run1, run2, run3]);

    expect(fetchCallCount).toBe(2);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('reconcileWeekPlan — 13. one conflicted day does not stop other days', () => {
  it('a conflicting day and a clean-newer day in the same batch are each decided independently', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, applyMetadataPatch, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const conflictDay = await firstValidDayKey();
    const cleanDay = await secondValidDayKey();

    // Conflicting day: dirty local vs. server advanced.
    await applyMetadataPatch('week-plan', conflictDay, { lastSeenVersion: 4, isDeleted: false, isDirty: false });
    await writeOneWeekPlanItemLocal({ ...item(conflictDay), requestId: 'req-conflict-local' });
    await markActive('week-plan', conflictDay);

    // Clean day: not dirty, server simply advanced.
    await writeOneWeekPlanItemLocal(item(cleanDay));
    await applyMetadataPatch('week-plan', cleanDay, { lastSeenVersion: 1, isDeleted: false, isDirty: false });

    fetchWeekPlanForReconciliation.mockResolvedValue([
      { ...item(conflictDay), requestId: 'req-conflict-server', syncVersion: 5, deletedAt: null },
      { ...item(cleanDay), requestId: 'req-clean-server', syncVersion: 2, deletedAt: null },
    ]);

    const summary = await reconcileWeekPlan();

    expect(summary.considered).toBe(2);
    expect(summary.conflicts).toBe(1);
    expect(summary.success).toBe(1);
    expect((await getMetadata('week-plan', conflictDay))?.isDirty).toBe(true);
    expect(await getMetadata('week-plan', cleanDay)).toEqual({ lastSeenVersion: 2, isDeleted: false, isDirty: false });
  });
});

describe('reconcileWeekPlan — 14. automatic day-rollover pruning is never resurrected', () => {
  it('an expired day that still has active metadata and an active server row is skipped entirely, never re-materialized, and its stale metadata is cleaned up', async () => {
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { applyMetadataPatch } = await import('@/lib/sync-metadata-storage');
    const { readOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const expiredDayKey = '2020-01-01'; // always outside any real retention window
    // Simulates the exact drift scenario: local housekeeping already pruned
    // this day (loadWeekPlan's own filter+persist), but metadata still says
    // "active, not dirty" and the server still has a row for it.
    await applyMetadataPatch('week-plan', expiredDayKey, { lastSeenVersion: 3, isDeleted: false, isDirty: false });
    fetchWeekPlanForReconciliation.mockResolvedValue([
      { ...item(expiredDayKey), syncVersion: 3, deletedAt: null },
    ]);

    const summary = await reconcileWeekPlan();

    expect(summary.considered).toBe(0); // excluded entirely, not even counted
    expect(createWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(updateWeekPlanItemViaRpc).not.toHaveBeenCalled();
    expect(await readOneWeekPlanItemLocal(expiredDayKey)).toBeNull(); // never re-materialized
    expect(await getMetadata('week-plan', expiredDayKey)).toBeNull(); // stale metadata cleaned up
  });

  it('a genuine local write for a day still inside the window is unaffected by the retention filter', async () => {
    const { writeOneWeekPlanItemLocal } = await import('@/lib/week-plan-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = await firstValidDayKey();
    await writeOneWeekPlanItemLocal(item(dayKey));
    await markActive('week-plan', dayKey);
    createWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    const summary = await reconcileWeekPlan();

    expect(summary.considered).toBe(1);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});
