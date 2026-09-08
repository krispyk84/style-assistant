import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B hooks added to saved-outfits-storage.ts actually
// write real sync metadata through the real sync-metadata-storage module
// (backed by the same in-memory AsyncStorage), not just that they were
// called — and that they don't change this file's existing return values.

const storageMock = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storageMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storageMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

vi.mock('@/lib/crashlytics', () => ({ recordError: vi.fn(), log: vi.fn() }));

const upsertSavedOutfitToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteSavedOutfitFromSupabase = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/supabase-data', () => ({
  upsertSavedOutfitToSupabase: (...args: unknown[]) => upsertSavedOutfitToSupabase(...args),
  deleteSavedOutfitFromSupabase: (...args: unknown[]) => deleteSavedOutfitFromSupabase(...args),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertSavedOutfitToSupabase.mockClear();
  deleteSavedOutfitFromSupabase.mockClear();
});

// The sync-metadata hooks are deliberately fire-and-forget (`void x().catch(...)`)
// so they never block or slow the real save/delete — matching this file's
// existing convention for the cloud upsert/delete calls. That means the
// metadata write can still be in flight when the awaited call above returns;
// flush pending microtasks before asserting on it (same pattern used by
// backend/src/modules/seasonal-trends/__tests__/seasonal-trends.service.test.ts).
async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

const INPUT = { anchorItemDescription: 'test', anchorItems: [] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('saved-outfits-storage — Phase 1B sync-metadata hooks', () => {
  it('saveSavedOutfit marks the record active with no fabricated version', async () => {
    const { saveSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    const saved = await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-1', 0);
    const id = buildSavedOutfitId('req-1', 'business', 0);
    await flushMicrotasks();

    expect(saved.id).toBe(id);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: false });
  });

  it('deleteSavedOutfit records a tombstone that survives after the domain object is gone', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-2', 0);
    const id = buildSavedOutfitId('req-2', 'business', 0);
    await flushMicrotasks();

    const remaining = await deleteSavedOutfit(id);
    await flushMicrotasks();

    expect(remaining.find((item) => item.id === id)).toBeUndefined();
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: true });
  });

  it('re-saving the same requestId+tier after deletion reactivates the tombstone (markActive), preserving semantics tested in sync-metadata-storage.test.ts', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata, setLastSeenVersion } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-3', 0);
    await flushMicrotasks();
    const id = buildSavedOutfitId('req-3', 'business', 0);
    await setLastSeenVersion('saved-outfits', id, 5);
    await deleteSavedOutfit(id);
    await flushMicrotasks();

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-3', 0);
    await flushMicrotasks();

    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 5, isDeleted: false });
  });
});
