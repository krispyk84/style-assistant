import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 1B.1 REVISION of this file: Phase 1B originally proved
// clearAllLocalUserData wiped a single global sync-metadata key on
// sign-out. That design was replaced (see sync-metadata-storage.ts's
// top-of-file note and user-data-sync.ts's OTHER_PER_USER_KEYS comment) —
// the storage key is now scoped per-user, and clearAllLocalUserData no
// longer touches it at all. This file now proves the invariant that
// actually matters: User A's sync metadata can never appear for User B,
// AND (unlike every other per-user cache) correctly SURVIVES sign-out for
// the SAME user — both by construction of the per-user key, not by an
// explicit wipe step.

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

vi.mock('@/lib/closet-outfit-sync', () => ({
  fetchClosetOutfitFavouritesFromBackend: vi.fn(),
  fetchClosetOutfitWeekPlanFromBackend: vi.fn(),
  upsertManyClosetOutfitFavouritesToBackend: vi.fn(),
  upsertManyClosetOutfitWeekPlanItemsToBackend: vi.fn(),
}));

const getCurrentUserId = vi.fn().mockResolvedValue('user-a');
vi.mock('@/lib/supabase-data', () => ({
  fetchClosetItemsFromSupabase: vi.fn(),
  upsertManyClosetItemsToSupabase: vi.fn(),
  fetchSavedOutfitsFromSupabase: vi.fn(),
  upsertManySavedOutfitsToSupabase: vi.fn(),
  fetchWeekPlanFromSupabase: vi.fn(),
  upsertManyWeekPlanItemsToSupabase: vi.fn(),
  getCurrentUserId: () => getCurrentUserId(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  getCurrentUserId.mockClear();
  getCurrentUserId.mockResolvedValue('user-a');
});

describe('clearAllLocalUserData — Phase 1B.1: sync metadata is no longer wiped, and no longer needs to be', () => {
  it('clearAllLocalUserData does NOT remove sync metadata for the current user', async () => {
    const { setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { clearAllLocalUserData } = await import('@/lib/user-data-sync');

    await setLastSeenVersion('saved-outfits', 'x', 7);
    await clearAllLocalUserData();

    expect(await getMetadata('saved-outfits', 'x')).toEqual({ lastSeenVersion: 7, isDeleted: false });
  });

  it('User A\'s metadata never appears for User B — isolation comes from the per-user key, not from a sign-out wipe', async () => {
    const { setLastSeenVersion, markDeleted, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { clearAllLocalUserData } = await import('@/lib/user-data-sync');

    // User A does some work, then signs out (clearAllLocalUserData runs,
    // but per Phase 1B.1 does not touch sync metadata at all).
    getCurrentUserId.mockResolvedValue('user-a');
    await setLastSeenVersion('saved-outfits', 'shared-id', 7);
    await markDeleted('week-plan', 'a-only-day');
    await clearAllLocalUserData();

    // User B signs in on the same device.
    getCurrentUserId.mockResolvedValue('user-b');
    expect(await getMetadata('saved-outfits', 'shared-id')).toBeNull();
    expect(await getMetadata('week-plan', 'a-only-day')).toBeNull();
  });

  it('User A signing out and back in on the SAME device still sees their own prior sync metadata — this is intended (unlike every other per-user cache), not a leak', async () => {
    const { setLastSeenVersion, getMetadata } = await import('@/lib/sync-metadata-storage');
    const { clearAllLocalUserData } = await import('@/lib/user-data-sync');

    getCurrentUserId.mockResolvedValue('user-a');
    await setLastSeenVersion('saved-outfits', 'x', 3);
    await clearAllLocalUserData(); // sign-out

    // ... User A signs back in later ...
    expect(await getMetadata('saved-outfits', 'x')).toEqual({ lastSeenVersion: 3, isDeleted: false });
  });
});
