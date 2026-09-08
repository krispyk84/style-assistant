import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B hooks added to closet-outfit-storage.ts (covering
// BOTH sub-domains: closet-outfit-favourites and closet-outfit-week-plan)
// write real sync metadata, and that week-plan's day-rollover pruning
// still does not tombstone anything for this sibling domain either.

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

const upsertClosetOutfitFavouriteToBackend = vi.fn().mockResolvedValue(undefined);
const deleteClosetOutfitFavouriteFromBackend = vi.fn().mockResolvedValue(undefined);
const upsertClosetOutfitWeekPlanItemToBackend = vi.fn().mockResolvedValue(undefined);
const deleteClosetOutfitWeekPlanItemFromBackend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/closet-outfit-sync', () => ({
  upsertClosetOutfitFavouriteToBackend: (...args: unknown[]) => upsertClosetOutfitFavouriteToBackend(...args),
  deleteClosetOutfitFavouriteFromBackend: (...args: unknown[]) => deleteClosetOutfitFavouriteFromBackend(...args),
  upsertClosetOutfitWeekPlanItemToBackend: (...args: unknown[]) => upsertClosetOutfitWeekPlanItemToBackend(...args),
  deleteClosetOutfitWeekPlanItemFromBackend: (...args: unknown[]) => deleteClosetOutfitWeekPlanItemFromBackend(...args),
}));

// closet-outfit-storage.ts imports getNextSevenDays from week-plan-storage.ts
// purely for its pure date-math helper, but that file also imports
// lib/supabase-data.ts, which constructs a real Supabase client at import
// time — mock it away the same way, even though this file's own tests
// never call these functions directly.
vi.mock('@/lib/supabase-data', () => ({
  upsertWeekPlanItemToSupabase: vi.fn().mockResolvedValue(undefined),
  deleteWeekPlanItemFromSupabase: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertClosetOutfitFavouriteToBackend.mockClear();
  deleteClosetOutfitFavouriteFromBackend.mockClear();
  upsertClosetOutfitWeekPlanItemToBackend.mockClear();
  deleteClosetOutfitWeekPlanItemFromBackend.mockClear();
});

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

const OUTFIT = { id: 'outfit-1', title: 't', whyItWorks: 'w', items: [], framework: {}, feedbackId: 'f', feedback: null, sketchJobId: 's', sketchStatus: 'ready', sketchImageUrl: null } as unknown as import('@/types/api').ClosetGeneratedOutfit;

describe('closet-outfit-storage — Phase 1B sync-metadata hooks (favourites)', () => {
  it('saveClosetOutfitToFavourites marks the record active, no fabricated version', async () => {
    const { saveClosetOutfitToFavourites } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveClosetOutfitToFavourites('business', OUTFIT);
    await flushMicrotasks();

    expect(await getMetadata('closet-outfit-favourites', 'outfit-1')).toEqual({ lastSeenVersion: null, isDeleted: false });
  });

  it('deleteSavedClosetOutfit records a tombstone', async () => {
    const { saveClosetOutfitToFavourites, deleteSavedClosetOutfit } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    await saveClosetOutfitToFavourites('business', OUTFIT);
    await flushMicrotasks();
    await deleteSavedClosetOutfit('outfit-1');
    await flushMicrotasks();

    expect(await getMetadata('closet-outfit-favourites', 'outfit-1')).toEqual({ lastSeenVersion: null, isDeleted: true });
  });
});

describe('closet-outfit-storage — Phase 1B sync-metadata hooks (week plan)', () => {
  it('assignClosetOutfitToWeekDay marks the day active', async () => {
    const { assignClosetOutfitToWeekDay } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignClosetOutfitToWeekDay(dayKey, 'Today', 'business', OUTFIT);
    await flushMicrotasks();

    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: false });
  });

  it('removeClosetWeekPlanDay records a tombstone; day-rollover pruning in loadClosetWeekPlan does not', async () => {
    const { assignClosetOutfitToWeekDay, removeClosetWeekPlanDay, loadClosetWeekPlan } = await import('@/lib/closet-outfit-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const { getNextSevenDays } = await import('@/lib/week-plan-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignClosetOutfitToWeekDay(dayKey, 'Today', 'business', OUTFIT);
    await flushMicrotasks();
    await removeClosetWeekPlanDay(dayKey);
    await flushMicrotasks();
    expect(await getMetadata('closet-outfit-week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: true });

    const staleDayKey = '2000-01-01';
    storageMock.set('style-assistant/closet-outfit-week-plan', JSON.stringify([
      { dayKey: staleDayKey, dayLabel: 'Stale', formality: 'business', assignedAt: '2000-01-01T00:00:00.000Z', outfit: OUTFIT },
    ]));
    await loadClosetWeekPlan();
    await flushMicrotasks();
    expect(await getMetadata('closet-outfit-week-plan', staleDayKey)).toBeNull();
  });
});
