import { beforeEach, describe, expect, it, vi } from 'vitest';

// Proves the Phase 1B hooks added to week-plan-storage.ts write real sync
// metadata through the real sync-metadata-storage module, and — critically
// for this domain — that loadWeekPlan's automatic day-rollover pruning
// does NOT touch metadata (only assignOutfitToWeekDay/removeWeekPlan do).

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

const upsertWeekPlanItemToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteWeekPlanItemFromSupabase = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/supabase-data', () => ({
  upsertWeekPlanItemToSupabase: (...args: unknown[]) => upsertWeekPlanItemToSupabase(...args),
  deleteWeekPlanItemFromSupabase: (...args: unknown[]) => deleteWeekPlanItemFromSupabase(...args),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertWeekPlanItemToSupabase.mockClear();
  deleteWeekPlanItemFromSupabase.mockClear();
});

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

const INPUT = {} as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchStatus: 'ready', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('week-plan-storage — Phase 1B sync-metadata hooks', () => {
  it('assignOutfitToWeekDay marks the day active with no fabricated version', async () => {
    const { assignOutfitToWeekDay, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await flushMicrotasks();

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: false });
  });

  it('removeWeekPlan records a tombstone', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await flushMicrotasks();
    await removeWeekPlan(dayKey);
    await flushMicrotasks();

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: null, isDeleted: true });
  });

  it('reassigning a removed day reactivates the tombstone, preserving any known lastSeenVersion', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { getMetadata, setLastSeenVersion } = await import('@/lib/sync-metadata-storage');
    const dayKey = getNextSevenDays()[0].dayKey;

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-1');
    await flushMicrotasks();
    await setLastSeenVersion('week-plan', dayKey, 2);
    await removeWeekPlan(dayKey);
    await flushMicrotasks();

    await assignOutfitToWeekDay(dayKey, 'Today', INPUT, RECOMMENDATION, 'req-2');
    await flushMicrotasks();

    expect(await getMetadata('week-plan', dayKey)).toEqual({ lastSeenVersion: 2, isDeleted: false });
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
    await flushMicrotasks();

    expect(afterLoad.find((item) => item.dayKey === staleDayKey)).toBeUndefined();
    // The critical assertion: pruning is not a user deletion, so no
    // tombstone should exist for it at all — not isDeleted:true, not
    // anything. It must be exactly as if this module never ran.
    expect(await getMetadata('week-plan', staleDayKey)).toBeNull();
  });
});
