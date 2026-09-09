import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B/1B.1 hooks in saved-outfits-storage.ts actually write
// real sync metadata through the real sync-metadata-storage module (backed
// by the same in-memory, FAILABLE AsyncStorage mock below), not just that
// they were called — including deliberately injecting storage-layer
// failures (Phase 1B.1 Part 3), not just mocking the whole feature away.

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

const upsertSavedOutfitToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteSavedOutfitFromSupabase = vi.fn().mockResolvedValue(undefined);
const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
vi.mock('@/lib/supabase-data', () => ({
  upsertSavedOutfitToSupabase: (...args: unknown[]) => upsertSavedOutfitToSupabase(...args),
  deleteSavedOutfitFromSupabase: (...args: unknown[]) => deleteSavedOutfitFromSupabase(...args),
  getCurrentUserId: () => getCurrentUserId(),
}));

const SYNC_METADATA_KEY = 'style-assistant/sync-metadata/user-1';
const DOMAIN_KEY = 'style-assistant/saved-outfits';

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  upsertSavedOutfitToSupabase.mockClear();
  deleteSavedOutfitFromSupabase.mockClear();
  getCurrentUserId.mockClear();
  getCurrentUserId.mockResolvedValue('user-1');
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [{ id: 'anchor-primary', description: 'test', image: null, uploadedImage: null }] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('saved-outfits-storage — Phase 1B sync-metadata hooks (happy path)', () => {
  it('saveSavedOutfit marks the record active with no fabricated version', async () => {
    const { saveSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    const saved = await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-1', 0);
    const id = buildSavedOutfitId('req-1', 'business', 0);

    expect(saved.id).toBe(id);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });

  it('deleteSavedOutfit records a tombstone that survives after the domain object is gone', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-2', 0);
    const id = buildSavedOutfitId('req-2', 'business', 0);

    const remaining = await deleteSavedOutfit(id);

    expect(remaining.find((item) => item.id === id)).toBeUndefined();
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });

  it('re-saving the same requestId+tier after deletion reactivates the tombstone (markActive), preserving semantics tested in sync-metadata-storage.test.ts', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata, setLastSeenVersion } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-3', 0);
    const id = buildSavedOutfitId('req-3', 'business', 0);
    await setLastSeenVersion('saved-outfits', id, 5);
    await deleteSavedOutfit(id);

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-3', 0);

    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: true });
  });
});

describe('saved-outfits-storage — Phase 1B.1 failure modes: delete', () => {
  it('metadata tombstone write fails -> deleteSavedOutfit rejects and the domain object is NOT removed (deletion never proceeds without a durable tombstone)', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, loadSavedOutfits, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-1', 0);
    const id = buildSavedOutfitId('req-fail-1', 'business', 0);

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(deleteSavedOutfit(id)).rejects.toThrow(/injected storage failure/);

    failingKeys.delete(SYNC_METADATA_KEY);
    const remaining = await loadSavedOutfits();
    expect(remaining.find((item) => item.id === id)).toBeDefined(); // still present — deletion did not proceed
  });

  it('tombstone write succeeds, THEN the domain-object write fails -> deleteSavedOutfit rejects, but the tombstone is durably recorded (recoverable: a retry would simply finish removing the domain object)', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, loadSavedOutfits, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-2', 0);
    const id = buildSavedOutfitId('req-fail-2', 'business', 0);

    failingKeys.add(DOMAIN_KEY); // the domain object's own storage key, NOT the metadata key
    await expect(deleteSavedOutfit(id)).rejects.toThrow(/injected storage failure/);

    // The state is honestly recoverable, not silently ambiguous: the
    // tombstone is already durable even though the visible list wasn't
    // updated yet.
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });

    failingKeys.delete(DOMAIN_KEY);
    const remaining = await loadSavedOutfits();
    expect(remaining.find((item) => item.id === id)).toBeDefined(); // domain object never actually got removed by the failed attempt
    // A retry of the same delete is safe and idempotent, and now completes cleanly.
    await deleteSavedOutfit(id);
    expect((await loadSavedOutfits()).find((item) => item.id === id)).toBeUndefined();
  });
});

describe('saved-outfits-storage — Phase 1B.1 failure modes: re-create / save', () => {
  it('failure during markActive on a fresh save propagates — the save is not reported as successful while metadata silently diverges', async () => {
    const { saveSavedOutfit } = await import('@/lib/saved-outfits-storage');

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-3', 0)).rejects.toThrow(/injected storage failure/);
  });

  it('failure during markActive while reactivating a tombstone does not silently report success — the caller sees the failure and can retry to resolve it, rather than the app believing a stale tombstone was cleared', async () => {
    const { saveSavedOutfit, deleteSavedOutfit, loadSavedOutfits, buildSavedOutfitId } = await import('@/lib/saved-outfits-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-4', 0);
    const id = buildSavedOutfitId('req-fail-4', 'business', 0);
    await deleteSavedOutfit(id);
    expect((await getMetadata('saved-outfits', id))?.isDeleted).toBe(true);

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-4', 0)).rejects.toThrow(/injected storage failure/);
    failingKeys.delete(SYNC_METADATA_KEY);

    // The critical assertion: because saveSavedOutfit rejected, this was
    // never observed as a successful re-creation — the tombstone still
    // truthfully says deleted (matching the last durable outcome), even
    // though the domain object write (which runs before the metadata call
    // in this function) already happened. That's an honest, recoverable
    // partial state, not a silent contradiction the caller believes is fine.
    expect((await getMetadata('saved-outfits', id))?.isDeleted).toBe(true);
    expect((await loadSavedOutfits()).find((item) => item.id === id)).toBeDefined();

    // Retrying (with metadata storage working again) cleanly resolves it.
    const retried = await saveSavedOutfit(INPUT, RECOMMENDATION, 'req-fail-4', 0);
    expect(retried.id).toBe(id);
    expect(await getMetadata('saved-outfits', id)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });
});
