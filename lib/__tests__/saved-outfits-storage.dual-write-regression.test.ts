import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A1 §2/§16 MANDATORY regression test: proves a saved-outfit
// save/delete through the real lib/saved-outfits-storage.ts entry points
// can NEVER invoke both the legacy unconditional Supabase upsert/delete AND
// the new version-aware RPC path for the same operation. This is the
// cutover invariant itself, not a re-test of reconciliation behavior (see
// saved-outfits-reconciliation.test.ts for that) — the only thing asserted
// here is call counts on the two architectures.

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

const upsertSavedOutfitToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteSavedOutfitFromSupabase = vi.fn().mockResolvedValue(undefined);
const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
const fetchSavedOutfitsForReconciliation = vi.fn().mockResolvedValue([]);
const createSavedOutfitViaRpc = vi.fn();
const updateSavedOutfitViaRpc = vi.fn();
const deleteSavedOutfitViaRpc = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  // Legacy architecture — must never be called from the new client path.
  upsertSavedOutfitToSupabase: (...args: unknown[]) => upsertSavedOutfitToSupabase(...args),
  deleteSavedOutfitFromSupabase: (...args: unknown[]) => deleteSavedOutfitFromSupabase(...args),
  // Version-aware architecture — the only one the new path may use.
  getCurrentUserId: () => getCurrentUserId(),
  fetchSavedOutfitsForReconciliation: () => fetchSavedOutfitsForReconciliation(),
  createSavedOutfitViaRpc: (...args: unknown[]) => createSavedOutfitViaRpc(...args),
  updateSavedOutfitViaRpc: (...args: unknown[]) => updateSavedOutfitViaRpc(...args),
  deleteSavedOutfitViaRpc: (...args: unknown[]) => deleteSavedOutfitViaRpc(...args),
  createWeekPlanItemViaRpc: vi.fn(),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertSavedOutfitToSupabase.mockClear();
  deleteSavedOutfitFromSupabase.mockClear();
  getCurrentUserId.mockClear().mockResolvedValue('user-1');
  fetchSavedOutfitsForReconciliation.mockClear().mockResolvedValue([]);
  createSavedOutfitViaRpc.mockReset().mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
  updateSavedOutfitViaRpc.mockReset();
  deleteSavedOutfitViaRpc.mockReset().mockResolvedValue({ status: 'applied', version: 2, deletedAt: '2026-01-01T00:00:00Z', content: null });
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [{ id: 'anchor-primary', description: 'test', image: null, uploadedImage: null }] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

// saveSavedOutfit/deleteSavedOutfit each fire their own best-effort
// reconciliation via a dynamic import — never awaited by the storage
// function itself (local-first UX). Awaiting the SAME import specifier
// here (Node/V8 cache dynamic import promises per specifier) guarantees
// that call's `.then()` callback has already registered with
// reconcileSavedOutfits' single-flight state before this test's own
// explicit call — otherwise the two calls can race, the explicit one can
// finish first, and the storage function's call becomes an orphaned
// promise that only fires once its own dynamic import resolves, possibly
// during a LATER test (corrupting its mock call counts).
async function settleAutoTriggeredReconciliation() {
  await import('@/lib/saved-outfits-reconciliation');
}

describe('saved-outfits dual-write regression (mandatory)', () => {
  it('a new save invokes ONLY the version-aware create path — legacy upsertSavedOutfitToSupabase is never called', async () => {
    const { saveSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-dual-1', 0);
    const id = buildSavedOutfitId('req-dual-1', 'business', 0);
    await settleAutoTriggeredReconciliation();
    await reconcileSavedOutfits();

    expect(upsertSavedOutfitToSupabase).toHaveBeenCalledTimes(0);
    expect(createSavedOutfitViaRpc).toHaveBeenCalledTimes(1);
    expect(createSavedOutfitViaRpc.mock.calls[0]![0]).toMatchObject({ id });
  });

  it('a delete invokes ONLY the version-aware CAS delete path — legacy deleteSavedOutfitFromSupabase is never called', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-dual-2', 0);
    const id = buildSavedOutfitId('req-dual-2', 'business', 0);
    await settleAutoTriggeredReconciliation();
    await reconcileSavedOutfits();
    upsertSavedOutfitToSupabase.mockClear();
    // Reflect the just-created row server-side so the delete below is
    // decided against real state (an ever-absent server would make the
    // engine conclude the delete's goal is already achieved and never call
    // the RPC at all).
    fetchSavedOutfitsForReconciliation.mockResolvedValue([
      { id, requestId: 'req-dual-2', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION, syncVersion: 1, deletedAt: null },
    ]);

    await deleteSavedOutfit(id);
    await settleAutoTriggeredReconciliation();
    await reconcileSavedOutfits();

    expect(upsertSavedOutfitToSupabase).toHaveBeenCalledTimes(0);
    expect(deleteSavedOutfitFromSupabase).toHaveBeenCalledTimes(0);
    expect(deleteSavedOutfitViaRpc).toHaveBeenCalledTimes(1);
    expect(deleteSavedOutfitViaRpc).toHaveBeenCalledWith(id, 1);
  });

  it('across a full save-then-delete lifecycle, the legacy architecture is invoked exactly zero times', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-dual-3', 0);
    const id = buildSavedOutfitId('req-dual-3', 'business', 0);
    await settleAutoTriggeredReconciliation();
    await reconcileSavedOutfits();
    await deleteSavedOutfit(id);
    await settleAutoTriggeredReconciliation();
    await reconcileSavedOutfits();

    expect(upsertSavedOutfitToSupabase).not.toHaveBeenCalled();
    expect(deleteSavedOutfitFromSupabase).not.toHaveBeenCalled();
  });
});
