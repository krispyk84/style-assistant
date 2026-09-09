import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A4 §27 — full-system concurrency test. Runs all four migrated
// domains' reconciliation triggers concurrently (simulating the
// HYDRATED/SIGNED_IN lifecycle firing all four at once, per
// contexts/useAuthSideEffects.ts) alongside a genuinely fresh local
// mutation in EACH domain and a deliberately slow/failing run in others.
// Proves the two properties per-domain tests can't: (1) domains never wait
// on each other — a slow closet-outfit-favourites run does not delay
// saved-outfits/week-plan/closet-outfit-week-plan completing; (2) one
// domain's operational failure does not affect another domain's success in
// the same tick. Each domain's own single-flight coalescing is already
// covered individually in its own *-reconciliation.test.ts file — this file
// is deliberately narrow: cross-domain independence only.

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
const fetchSavedOutfitsForReconciliation = vi.fn().mockResolvedValue([]);
const createSavedOutfitViaRpc = vi.fn();
const fetchWeekPlanForReconciliation = vi.fn().mockResolvedValue([]);
const createWeekPlanItemViaRpc = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserId(),
  fetchSavedOutfitsForReconciliation: () => fetchSavedOutfitsForReconciliation(),
  createSavedOutfitViaRpc: (...args: unknown[]) => createSavedOutfitViaRpc(...args),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
  fetchWeekPlanForReconciliation: () => fetchWeekPlanForReconciliation(),
  createWeekPlanItemViaRpc: (...args: unknown[]) => createWeekPlanItemViaRpc(...args),
  updateWeekPlanItemViaRpc: vi.fn(),
  deleteWeekPlanItemViaRpc: vi.fn(),
}));

const fetchClosetOutfitFavouritesForReconciliation = vi.fn();
const createClosetOutfitFavouriteViaRpc = vi.fn();
const fetchClosetOutfitWeekPlanForReconciliation = vi.fn().mockResolvedValue([]);
const createClosetOutfitWeekPlanItemViaRpc = vi.fn();
vi.mock('@/lib/closet-outfit-sync', () => ({
  fetchClosetOutfitFavouritesForReconciliation: () => fetchClosetOutfitFavouritesForReconciliation(),
  createClosetOutfitFavouriteViaRpc: (...args: unknown[]) => createClosetOutfitFavouriteViaRpc(...args),
  updateClosetOutfitFavouriteViaRpc: vi.fn(),
  deleteClosetOutfitFavouriteViaRpc: vi.fn(),
  fetchClosetOutfitWeekPlanForReconciliation: () => fetchClosetOutfitWeekPlanForReconciliation(),
  createClosetOutfitWeekPlanItemViaRpc: (...args: unknown[]) => createClosetOutfitWeekPlanItemViaRpc(...args),
  updateClosetOutfitWeekPlanItemViaRpc: vi.fn(),
  deleteClosetOutfitWeekPlanItemViaRpc: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  getCurrentUserId.mockClear().mockResolvedValue('user-1');
  fetchSavedOutfitsForReconciliation.mockReset().mockResolvedValue([]);
  createSavedOutfitViaRpc.mockReset();
  fetchWeekPlanForReconciliation.mockReset().mockResolvedValue([]);
  createWeekPlanItemViaRpc.mockReset();
  fetchClosetOutfitFavouritesForReconciliation.mockReset();
  createClosetOutfitFavouriteViaRpc.mockReset();
  fetchClosetOutfitWeekPlanForReconciliation.mockReset().mockResolvedValue([]);
  createClosetOutfitWeekPlanItemViaRpc.mockReset();
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;
const CLOSET_OUTFIT = { id: 'closet-outfit-1' } as unknown as import('@/types/api').ClosetGeneratedOutfit;

describe('all four domains — full-system concurrency (Phase 3A4 §27)', () => {
  it('a slow closet-outfit-favourites run does not delay saved-outfits/week-plan/closet-outfit-week-plan completing, and one domain failing does not affect the others', async () => {
    const { writeOneSavedOutfitLocal, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { writeOneWeekPlanItemLocal, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { writeOneSavedClosetOutfitLocal, writeOneClosetWeekPlanItemLocal } = await import('@/lib/closet-outfit-storage');
    const { markActive } = await import('@/lib/sync-metadata-storage');
    const { reconcileSavedOutfits } = await import('@/lib/saved-outfits-reconciliation');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');
    const { reconcileClosetOutfitFavourites } = await import('@/lib/closet-outfit-favourites-reconciliation');
    const { reconcileClosetOutfitWeekPlan } = await import('@/lib/closet-outfit-week-plan-reconciliation');

    // Fresh, genuinely dirty local mutations in all four domains at once —
    // exactly what a HYDRATED trigger would see alongside concurrent user
    // actions across every tab.
    const savedOutfitId = buildSavedOutfitId('req-1', 'business', 0);
    await writeOneSavedOutfitLocal({ id: savedOutfitId, requestId: 'req-1', savedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('saved-outfits', savedOutfitId);

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await writeOneWeekPlanItemLocal({ dayKey, dayLabel: 'Monday', requestId: 'req-2', assignedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION });
    await markActive('week-plan', dayKey);

    await writeOneSavedClosetOutfitLocal({ id: 'fav-1', formality: 'business', outfit: CLOSET_OUTFIT, savedAt: '2026-01-01T00:00:00Z' });
    await markActive('closet-outfit-favourites', 'fav-1');

    await writeOneClosetWeekPlanItemLocal({ dayKey, dayLabel: 'Monday', formality: 'business', outfit: CLOSET_OUTFIT, assignedAt: '2026-01-01T00:00:00Z' });
    await markActive('closet-outfit-week-plan', dayKey);

    // saved-outfits and week-plan: succeed immediately.
    createSavedOutfitViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    createWeekPlanItemViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    // closet-outfit-favourites: deliberately slow — its server read blocks
    // on a gate this test controls, simulating a run still in flight long
    // after the other three domains have already finished.
    let releaseFavouritesGate: (() => void) | null = null;
    const favouritesGate = new Promise<void>((resolve) => { releaseFavouritesGate = resolve; });
    fetchClosetOutfitFavouritesForReconciliation.mockImplementation(async () => {
      await favouritesGate;
      return [];
    });
    createClosetOutfitFavouriteViaRpc.mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
    // closet-outfit-week-plan: deliberately fails (operational failure).
    createClosetOutfitWeekPlanItemViaRpc.mockRejectedValue(new Error('backend unavailable'));

    // Fire all four exactly as the lifecycle trigger does — independent
    // calls, none awaited before starting the next.
    const savedOutfitsRun = reconcileSavedOutfits();
    const weekPlanRun = reconcileWeekPlan();
    const favouritesRun = reconcileClosetOutfitFavourites();
    const closetWeekPlanRun = reconcileClosetOutfitWeekPlan();

    // The three non-blocked domains must be able to complete WITHOUT
    // waiting for the favourites gate to release — race each against a
    // short synchronous flush to prove they don't hang on favouritesRun.
    const [savedOutfitsSummary, weekPlanSummary, closetWeekPlanSummary] = await Promise.all([
      savedOutfitsRun,
      weekPlanRun,
      closetWeekPlanRun,
    ]);

    expect(savedOutfitsSummary.success).toBe(1);
    expect(weekPlanSummary.success).toBe(1);
    expect(closetWeekPlanSummary.operationalFailures).toBe(1);
    // The failure in closet-outfit-week-plan never touched the others'
    // RPC calls or outcomes.
    expect(createSavedOutfitViaRpc).toHaveBeenCalledTimes(1);
    expect(createWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);

    // Now release the slow favourites run and confirm it independently
    // converges too — nothing about the other three finishing first or the
    // fourth one failing affected it.
    releaseFavouritesGate!();
    const favouritesSummary = await favouritesRun;
    expect(favouritesSummary.success).toBe(1);
    expect(createClosetOutfitFavouriteViaRpc).toHaveBeenCalledTimes(1);
  });
});
