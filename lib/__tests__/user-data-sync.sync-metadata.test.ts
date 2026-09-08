import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B addition to clearAllLocalUserData's wipe list: sync
// metadata must be cleared on sign-out exactly like every other per-user
// local cache, so User A's acknowledged versions/tombstones can never
// appear for User B on the same device.

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

vi.mock('@/lib/auth-event-log', () => ({ logAuthEvent: vi.fn() }));

// user-data-sync.ts's syncUserDataOnSignIn pulls in the full cloud-fetch
// surface (closet-outfit-sync + supabase-data) — irrelevant to
// clearAllLocalUserData, which this file only tests, but still imported
// transitively and must not throw at module load.
vi.mock('@/lib/closet-outfit-sync', () => ({
  fetchClosetOutfitFavouritesFromBackend: vi.fn(),
  fetchClosetOutfitWeekPlanFromBackend: vi.fn(),
  upsertManyClosetOutfitFavouritesToBackend: vi.fn(),
  upsertManyClosetOutfitWeekPlanItemsToBackend: vi.fn(),
}));
vi.mock('@/lib/supabase-data', () => ({
  fetchClosetItemsFromSupabase: vi.fn(),
  upsertManyClosetItemsToSupabase: vi.fn(),
  fetchSavedOutfitsFromSupabase: vi.fn(),
  upsertManySavedOutfitsToSupabase: vi.fn(),
  fetchWeekPlanFromSupabase: vi.fn(),
  upsertManyWeekPlanItemsToSupabase: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
});

describe('clearAllLocalUserData — Phase 1B sync-metadata wipe', () => {
  it('wipes sync metadata for every domain on sign-out, so User B never sees User A\'s acknowledged versions or tombstones', async () => {
    const { setLastSeenVersion, markDeleted, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { clearAllLocalUserData } = await import('@/lib/user-data-sync');

    // User A's synchronization state.
    await setLastSeenVersion('saved-outfits', 'userA-outfit', 7);
    await markDeleted('week-plan', 'userA-day');

    await clearAllLocalUserData();

    // If User B now signs in on the same device, both must read as never-seen.
    expect(await getMetadata('saved-outfits', 'userA-outfit')).toBeNull();
    expect(await getMetadata('week-plan', 'userA-day')).toBeNull();
  });

  it('clears the exact same storage key sync-metadata-storage.ts writes to', async () => {
    const { setLastSeenVersion } = await import('@/lib/sync-metadata-storage');
    const { clearAllLocalUserData } = await import('@/lib/user-data-sync');

    await setLastSeenVersion('saved-outfits', 'x', 1);
    expect(storageMock.has('style-assistant/sync-metadata')).toBe(true);

    await clearAllLocalUserData();

    expect(storageMock.has('style-assistant/sync-metadata')).toBe(false);
  });
});
