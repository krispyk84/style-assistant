import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A1 (sync redesign) — proves lib/saved-outfits-reconciliation.ts's
// reconcileSavedOutfits() against REAL local storage (saved-outfits-storage
// + sync-metadata-storage, both backed by the same in-memory FAILABLE
// AsyncStorage mock established in earlier phases' tests) and a MOCKED
// Supabase RPC layer (@/lib/supabase-data) — this is the orchestration
// module's own test file, not a re-test of the already-exhaustively-tested
// pure engine (reconciliation-decision-engine.test.ts) or executor
// (reconciliation-executor.test.ts). What's new and worth proving here is
// the LIVE wiring: per-record isolation across a real batch, the
// redecide-required convergence loop, and the single-flight/coalescing
// concurrency guard — none of which the lower-level unit tests exercise.

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
const fetchSavedOutfitsForReconciliation = vi.fn();
const createSavedOutfitViaRpc = vi.fn();
const updateSavedOutfitViaRpc = vi.fn();
const deleteSavedOutfitViaRpc = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserId(),
  fetchSavedOutfitsForReconciliation: () => fetchSavedOutfitsForReconciliation(),
  createSavedOutfitViaRpc: (...args: unknown[]) => createSavedOutfitViaRpc(...args),
  updateSavedOutfitViaRpc: (...args: unknown[]) => updateSavedOutfitViaRpc(...args),
  deleteSavedOutfitViaRpc: (...args: unknown[]) => deleteSavedOutfitViaRpc(...args),
  // Inert stand-ins: reconciliation-adapters.ts imports these for the OTHER
  // three domains' adapters at module load time. Never invoked by these
  // tests (only savedOutfitAdapter is exercised).
  createWeekPlanItemViaRpc: vi.fn(),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

const SYNC_METADATA_KEY = 'style-assistant/sync-metadata/user-1';

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  getCurrentUserId.mockReset().mockResolvedValue('user-1');
  fetchSavedOutfitsForReconciliation.mockReset().mockResolvedValue([]);
  createSavedOutfitViaRpc.mockReset();
  updateSavedOutfitViaRpc.mockReset();
  deleteSavedOutfitViaRpc.mockReset();
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [{ id: 'anchor-primary', description: 'test', image: null, uploadedImage: null }] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('reconcileSavedOutfits — K2 (known local creation)', () => {
  it('a fresh local save is pushed via createSavedOutfitViaRpc and metadata converges to non-dirty', async () => {
    const { saveSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    createSavedOutfitViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-1', 0);
    const id = buildSavedOutfitId('req-1', 'business', 0);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });

    const summary = await reconcileSavedOutfits();

    expect(createSavedOutfitViaRpc).toHaveBeenCalledTimes(1);
    expect(createSavedOutfitViaRpc.mock.calls[0]![0]).toMatchObject({ id, requestId: 'req-1' });
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
    expect(summary.success).toBe(1);
    expect(summary.dirtyRemaining).toBe(0);
  });

  it('create_conflict whose returned content matches local is recognized as this device\'s own lost-ack success (redecide converges to adopt, not a foreign conflict)', async () => {
    const { saveSavedOutfit, buildSavedOutfitId, readOneSavedOutfitLocal } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const saved = await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-2', 0);
    const id = buildSavedOutfitId('req-2', 'business', 0);

    // The RPC's own create_conflict response returns the SAME content this
    // device wrote — proving the earlier create actually succeeded and only
    // the acknowledgement was lost (e.g. app killed between RPC success and
    // metadata write).
    createSavedOutfitViaRpc.mockResolvedValue({
      status: 'create_conflict',
      version: 3,
      deletedAt: null,
      content: saved,
    });

    const summary = await reconcileSavedOutfits();

    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
    expect(summary.success).toBe(1);
    // ADOPT_SERVER writes server content into local storage — content is
    // identical here (that's the whole point), so this is a no-op rewrite.
    expect((await readOneSavedOutfitLocal(id))?.id).toBe(id);
  });

  it('create_conflict with genuinely DIFFERENT content under the same id is a real, unresolved collision — never overwritten automatically', async () => {
    const { saveSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-3', 0);
    const id = buildSavedOutfitId('req-3', 'business', 0);

    createSavedOutfitViaRpc.mockResolvedValue({
      status: 'create_conflict',
      version: 3,
      deletedAt: null,
      content: { id, requestId: 'req-3', savedAt: '2020-01-01T00:00:00Z', input: INPUT, recommendation: { ...RECOMMENDATION, tier: 'casual' } },
    });

    const summary = await reconcileSavedOutfits();

    expect(summary.conflicts).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    // Metadata is untouched — still dirty, still lastSeenVersion:null — no
    // silent resolution in either direction.
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });
});

describe('reconcileSavedOutfits — K1 (unknown-ancestry legacy state)', () => {
  it('a local record with NO sync metadata and server absent is deferred, never auto-created', async () => {
    const { writeOneSavedOutfitLocal } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    // Simulate a pre-existing local record from before Phase 1B/2B metadata
    // existed — present locally, no metadata entry, nothing server-side.
    await writeOneSavedOutfitLocal({
      id: 'legacy-1:business',
      requestId: 'legacy-1',
      savedAt: '2020-01-01T00:00:00Z',
      input: INPUT,
      recommendation: RECOMMENDATION,
    });

    const summary = await reconcileSavedOutfits();

    expect(createSavedOutfitViaRpc).not.toHaveBeenCalled();
    expect(summary.deferred).toBe(1);
    expect(summary.dirtyRemaining).toBe(0); // no metadata existed, so nothing was "dirty" to begin with
    expect(await getMetadata('saved-outfits', 'legacy-1:business')).toBeNull();
  });
});

describe('reconcileSavedOutfits — Phase 3B same-version legacy compatibility drift', () => {
  it('clean local, server shows the SAME acknowledged version but DIFFERENT content (a legacy write that never bumped sync_version) -> adopts the server truth, counted as sameVersionDrift, never silently missed', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-drift', 'business', 0);
    await writeOneSavedOutfitLocal({ id, requestId: 'req-drift', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await setLastSeenVersion('saved-outfits', id, 3); // acknowledged, clean (not dirty)

    // A legacy upsert changed the recommendation content but never touched
    // sync_version — server still reports version 3, content differs.
    fetchSavedOutfitsForReconciliation.mockResolvedValue([
      { id, requestId: 'req-drift', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: { ...RECOMMENDATION, tier: 'casual' }, syncVersion: 3, deletedAt: null },
    ]);

    const summary = await reconcileSavedOutfits();

    expect(createSavedOutfitViaRpc).not.toHaveBeenCalled();
    expect(summary.success).toBe(1);
    expect(summary.sameVersionDrift).toBe(1);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
  });
});

// The tests below use the Phase 2B2 reconciliation-only local helpers
// (writeOneSavedOutfitLocal / removeOneSavedOutfitLocal) plus
// sync-metadata-storage's primitives directly, rather than saveSavedOutfit
// / deleteSavedOutfit — those two now ALSO fire their own best-effort
// reconcileSavedOutfits() call internally (Phase 3A1 §4/§9), which would
// race unpredictably against a test that reconfigures an RPC mock's
// behavior a step later. saveSavedOutfit/deleteSavedOutfit's own wiring is
// covered separately (the K2 happy-path test above and the dedicated
// dual-write-regression file) using a mock that stays stable throughout,
// where that race genuinely cannot change the outcome.
describe('reconcileSavedOutfits — deletion (CAS + Case G preservation)', () => {
  it('deleting a previously-synced outfit issues a CAS soft delete with the acknowledged baseVersion', async () => {
    const { writeOneSavedOutfitLocal, removeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-4', 'business', 0);
    const content = { id, requestId: 'req-4', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION };
    await writeOneSavedOutfitLocal(content);
    await markActive('saved-outfits', id);
    await setLastSeenVersion('saved-outfits', id, 1); // already acknowledged by an earlier sync
    fetchSavedOutfitsForReconciliation.mockResolvedValue([{ ...content, syncVersion: 1, deletedAt: null }]);

    await markDeleted('saved-outfits', id);
    await removeOneSavedOutfitLocal(id);

    deleteSavedOutfitViaRpc.mockResolvedValue({ status: 'applied', version: 2, deletedAt: '2026-01-02T00:00:00Z', content: null });
    const summary = await reconcileSavedOutfits();

    expect(deleteSavedOutfitViaRpc).toHaveBeenCalledWith(id, 1);
    expect(summary.success).toBe(1);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 2, isDeleted: true, isDirty: false });
  });

  it('Case G: a stale delete against a server row someone else changed is a CONFLICT, never auto-upgraded and retried', async () => {
    const { writeOneSavedOutfitLocal, removeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-5', 'business', 0);
    const content = { id, requestId: 'req-5', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION };
    await writeOneSavedOutfitLocal(content);
    await markActive('saved-outfits', id);
    await setLastSeenVersion('saved-outfits', id, 1);

    await markDeleted('saved-outfits', id);
    await removeOneSavedOutfitLocal(id);
    // The server read this reconciliation pass observes shows version 2 —
    // someone else changed the row after this device's lastSeenVersion:1.
    fetchSavedOutfitsForReconciliation.mockResolvedValue([
      { id, requestId: 'req-5', savedAt: '2020-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION, syncVersion: 2, deletedAt: null },
    ]);

    const summary = await reconcileSavedOutfits();

    expect(deleteSavedOutfitViaRpc).not.toHaveBeenCalled();
    expect(summary.conflicts).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 1, isDeleted: true, isDirty: true });
  });
});

describe('reconcileSavedOutfits — per-record isolation', () => {
  it('one record throwing an unexpected error does not stop the others in the same batch', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const okId = buildSavedOutfitId('req-ok', 'business', 0);
    const badId = buildSavedOutfitId('req-bad', 'business', 0);
    await writeOneSavedOutfitLocal({ id: okId, requestId: 'req-ok', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('saved-outfits', okId);
    await writeOneSavedOutfitLocal({ id: badId, requestId: 'req-bad', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('saved-outfits', badId);

    createSavedOutfitViaRpc.mockImplementation((outfit: { id: string }) => {
      if (outfit.id === badId) return Promise.reject(new Error('network down'));
      return Promise.resolve({ status: 'created', version: 1, deletedAt: null, content: null });
    });

    const summary = await reconcileSavedOutfits();

    expect(summary.considered).toBe(2);
    expect(summary.success).toBe(1);
    expect(summary.operationalFailures).toBe(1);
    expect(summary.dirtyRemaining).toBe(1);
    expect(await getMetadata('saved-outfits', okId)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
    expect((await getMetadata('saved-outfits', badId))?.isDirty).toBe(true);
  });
});

describe('reconcileSavedOutfits — process-death / network-failure recovery', () => {
  it('a create that fails while offline leaves isDirty=true; a later successful pass converges it', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-6', 'business', 0);
    await writeOneSavedOutfitLocal({ id, requestId: 'req-6', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('saved-outfits', id);

    createSavedOutfitViaRpc.mockRejectedValue(new Error('offline'));
    const firstAttempt = await reconcileSavedOutfits();
    expect(firstAttempt.operationalFailures).toBe(1);
    expect((await getMetadata('saved-outfits', id))?.isDirty).toBe(true);

    // "Restart": network is back.
    createSavedOutfitViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    const secondAttempt = await reconcileSavedOutfits();

    expect(secondAttempt.success).toBe(1);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('a delete that fails while offline leaves the tombstone dirty; a later successful pass converges it, and the deferred/legacy record from a sibling id is untouched throughout', async () => {
    const { writeOneSavedOutfitLocal, removeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, markDeleted, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-7', 'business', 0);
    const content = { id, requestId: 'req-7', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION };
    await writeOneSavedOutfitLocal(content);
    await markActive('saved-outfits', id);
    await setLastSeenVersion('saved-outfits', id, 1);
    fetchSavedOutfitsForReconciliation.mockResolvedValue([{ ...content, syncVersion: 1, deletedAt: null }]);

    await markDeleted('saved-outfits', id);
    await removeOneSavedOutfitLocal(id);

    // A sibling legacy record with unknown ancestry, sitting alongside it.
    await writeOneSavedOutfitLocal({ id: 'legacy-2:business', requestId: 'legacy-2', savedAt: '2020-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });

    deleteSavedOutfitViaRpc.mockRejectedValue(new Error('offline'));
    const firstAttempt = await reconcileSavedOutfits();
    expect(firstAttempt.operationalFailures).toBe(1);
    expect(firstAttempt.deferred).toBe(1); // the legacy sibling, every pass
    expect((await getMetadata('saved-outfits', id))?.isDirty).toBe(true);
    expect(await getMetadata('saved-outfits', 'legacy-2:business')).toBeNull(); // never touched

    deleteSavedOutfitViaRpc.mockResolvedValue({ status: 'applied', version: 2, deletedAt: '2026-01-01T00:00:00Z', content: null });
    const secondAttempt = await reconcileSavedOutfits();
    expect(secondAttempt.success).toBe(1);
    expect(secondAttempt.deferred).toBe(1); // still untouched, still deferred — never a destructive write
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 2, isDeleted: true, isDirty: false });
    expect(await getMetadata('saved-outfits', 'legacy-2:business')).toBeNull();
  });
});

describe('reconcileSavedOutfits — single-flight coalescing', () => {
  it('a caller arriving mid-run is coalesced into exactly one follow-up run, never joins the stale in-flight snapshot, and never spawns a third run', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    let releaseFirstFetch: (() => void) | null = null;
    const firstFetchGate = new Promise<void>((resolve) => { releaseFirstFetch = resolve; });
    let fetchCallCount = 0;

    fetchSavedOutfitsForReconciliation.mockImplementation(async () => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) await firstFetchGate;
      return [];
    });
    createSavedOutfitViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });

    // Kick off run #1 — it blocks inside its own server-read fetch, so its
    // snapshot of local state/metadata is effectively taken "now", before
    // anything below happens.
    const run1 = reconcileSavedOutfits();

    // While run #1 is still blocked reading the server, a local write lands
    // (matching what saveSavedOutfit does internally: local content first,
    // then durable dirty metadata) — this is exactly the write run #1's
    // already-in-flight snapshot must not silently miss. Two more callers
    // arrive concurrently right after.
    const id = buildSavedOutfitId('req-8', 'business', 0);
    await writeOneSavedOutfitLocal({ id, requestId: 'req-8', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('saved-outfits', id);
    const run2 = reconcileSavedOutfits();
    const run3 = reconcileSavedOutfits();

    releaseFirstFetch!();
    await Promise.all([run1, run2, run3]);

    // Exactly two underlying runs happened: the original blocked one (which
    // saw an empty snapshot, taken before the write) and exactly one
    // coalesced follow-up (which picked up req-8's write) — never three.
    expect(fetchCallCount).toBe(2);
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

// Phase 3B2: a failed server read (missing reconciliation RPC, network
// error — anything fetchSavedOutfitsForReconciliation throws) must abort
// the whole run before deciding or applying anything, never be treated as
// "this user has zero server records." Proves the safety principle
// lib/domain-reconciliation-runner.ts's fetch-failure handling is built on.
describe('reconcileSavedOutfits — server read failure (Phase 3B2 safety net)', () => {
  it('aborts cleanly, leaves dirty local state untouched, and never attempts an RPC mutation', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { markActive, setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    const id = buildSavedOutfitId('req-9', 'business', 0);
    const content = { id, requestId: 'req-9', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION };
    await writeOneSavedOutfitLocal(content);
    await markActive('saved-outfits', id);
    await setLastSeenVersion('saved-outfits', id, 1);
    // Simulate a real dirty edit awaiting sync — this must survive the abort.
    const { applyMetadataPatch } = await import('@/lib/sync-metadata-storage');
    await applyMetadataPatch('saved-outfits', id, { isDirty: true });

    fetchSavedOutfitsForReconciliation.mockRejectedValue(new Error('fetchSavedOutfitsForReconciliation failed: rpc missing'));

    const summary = await reconcileSavedOutfits();

    expect(summary).toEqual({
      considered: 0, success: 0, noOp: 0, dirtyRemaining: 0, conflicts: 0, deferred: 0,
      operationalFailures: 0, sameVersionDrift: 0, versionLineageReset: 0,
      skippedReason: 'server-fetch-failed',
    });
    expect(createSavedOutfitViaRpc).not.toHaveBeenCalled();
    expect(updateSavedOutfitViaRpc).not.toHaveBeenCalled();
    expect(deleteSavedOutfitViaRpc).not.toHaveBeenCalled();
    // The dirty flag this run should have tried to resolve is still exactly
    // as it was before the aborted run — no silent fallback wiped it out.
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: true });
  });
});
