import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B/1B.1 hooks in week-plan-storage.ts write real sync
// metadata (via a FAILABLE in-memory AsyncStorage mock, so Part 3's
// failure-mode tests inject real storage-layer failures rather than
// mocking the whole feature away), and that loadWeekPlan's automatic
// day-rollover pruning never touches metadata.

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

const upsertWeekPlanItemToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteWeekPlanItemFromSupabase = vi.fn().mockResolvedValue(undefined);
const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
vi.mock('@/lib/supabase-data', () => ({
  upsertWeekPlanItemToSupabase: (...args: unknown[]) => upsertWeekPlanItemToSupabase(...args),
  deleteWeekPlanItemFromSupabase: (...args: unknown[]) => deleteWeekPlanItemFromSupabase(...args),
  getCurrentUserId: () => getCurrentUserId(),
}));

const SYNC_METADATA_KEY = 'style-assistant/sync-metadata/user-1';
const DOMAIN_KEY = 'style-assistant/week-plan';

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  upsertWeekPlanItemToSupabase.mockClear();
  deleteWeekPlanItemFromSupabase.mockClear();
  getCurrentUserId.mockClear();
  getCurrentUserId.mockResolvedValue('user-1');
});

const INPUT = {} as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchStatus: 'ready', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('week-plan-storage — Phase 1B sync-metadata hooks (happy path)', () => {
  it('assignOutfitToWeekDay marks the day active with no fabricated version', async () => {
    const { assignOutfitToWeekDay, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });

  it('removeWeekPlan records a tombstone', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await removeWeekPlan(dayKey);

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });

  it('reassigning a removed day reactivates the tombstone, preserving any known lastSeenVersion', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata, setLastSeenVersion } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await setLastSeenVersion('week-plan', dayKey, 2);
    await removeWeekPlan(dayKey);

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-2');

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 2, isDeleted: false, isDirty: true });
  });

  it('loadWeekPlan\'s automatic day-rollover pruning does NOT create a tombstone for the pruned day', async () => {
    const { loadWeekPlan } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');

    // A day far outside the next-7-days window — assigned directly to
    // local storage (bypassing assignOutfitToWeekDay, which would itself
    // reject/normalize it) to simulate a stale day already on disk from a
    // previous week, the scenario loadWeekPlan's pruning exists to handle.
    const staleDayKey = '2000-01-01';
    storageMock.set('style-assistant/week-plan', JSON.stringify([
      { dayKey: staleDayKey, dayLabel: 'Stale', requestId: 'req-old', assignedAt: '2000-01-01T00:00:00.000Z', input: INPUT, recommendation: RECOMMENDATION },
    ]));

    const afterLoad = await loadWeekPlan();

    expect(afterLoad.find((item) => item.dayKey === staleDayKey)).toBeUndefined();
    // The critical assertion: pruning is not a user deletion, so no
    // tombstone should exist for it at all — not isDeleted:true, not
    // anything. It must be exactly as if this module never ran.
    expect(await getMetadata('week-plan', staleDayKey)).toBeNull();
  });
});

describe('week-plan-storage — Phase 1B.1 failure modes: remove', () => {
  it('metadata tombstone write fails -> removeWeekPlan rejects and the day is NOT removed', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, loadWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const dayKey = getNextSevenDays()[0].dayKey;
    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(removeWeekPlan(dayKey)).rejects.toThrow(/injected storage failure/);

    failingKeys.delete(SYNC_METADATA_KEY);
    expect((await loadWeekPlan()).find((item) => item.dayKey === dayKey)).toBeDefined();
  });

  it('tombstone write succeeds, domain-object write fails -> removeWeekPlan rejects but the tombstone is durable and a retry safely finishes', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, loadWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;
    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');

    failingKeys.add(DOMAIN_KEY);
    await expect(removeWeekPlan(dayKey)).rejects.toThrow(/injected storage failure/);
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });

    failingKeys.delete(DOMAIN_KEY);
    expect((await loadWeekPlan()).find((item) => item.dayKey === dayKey)).toBeDefined();
    await removeWeekPlan(dayKey); // retry succeeds cleanly
    expect((await loadWeekPlan()).find((item) => item.dayKey === dayKey)).toBeUndefined();
  });
});

describe('week-plan-storage — Phase 1B.1 failure modes: assign / reactivate', () => {
  it('failure during markActive on a fresh assignment propagates rather than reporting success', async () => {
    const { assignOutfitToWeekDay, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1')).rejects.toThrow(/injected storage failure/);
  });

  it('failure during markActive while reactivating a tombstone surfaces to the caller; retrying resolves it cleanly', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await removeWeekPlan(dayKey);
    expect((await getMetadata('week-plan', dayKey))?.isDeleted).toBe(true);

    failingKeys.add(SYNC_METADATA_KEY);
    await expect(assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-2')).rejects.toThrow(/injected storage failure/);
    failingKeys.delete(SYNC_METADATA_KEY);

    expect((await getMetadata('week-plan', dayKey))?.isDeleted).toBe(true); // still honestly tombstoned, not silently cleared

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-2');
    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });
});
