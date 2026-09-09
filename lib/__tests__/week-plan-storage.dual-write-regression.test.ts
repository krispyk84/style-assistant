import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 3A2 §16/§22 MANDATORY regression test: proves a week-plan
// assign/reassign/clear through the real lib/week-plan-storage.ts entry
// points can NEVER invoke both the legacy unconditional Supabase
// upsert/delete AND the new version-aware RPC path for the same operation.

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

const upsertWeekPlanItemToSupabase = vi.fn().mockResolvedValue(undefined);
const deleteWeekPlanItemFromSupabase = vi.fn().mockResolvedValue(undefined);
const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
const fetchWeekPlanForReconciliation = vi.fn().mockResolvedValue([]);
const createWeekPlanItemViaRpc = vi.fn();
const updateWeekPlanItemViaRpc = vi.fn();
const deleteWeekPlanItemViaRpc = vi.fn();
vi.mock('@/lib/supabase-data', () => ({
  // Legacy architecture — must never be called from the new client path.
  upsertWeekPlanItemToSupabase: (...args: unknown[]) => upsertWeekPlanItemToSupabase(...args),
  deleteWeekPlanItemFromSupabase: (...args: unknown[]) => deleteWeekPlanItemFromSupabase(...args),
  // Version-aware architecture — the only one the new path may use.
  getCurrentUserId: () => getCurrentUserId(),
  fetchWeekPlanForReconciliation: () => fetchWeekPlanForReconciliation(),
  createWeekPlanItemViaRpc: (...args: unknown[]) => createWeekPlanItemViaRpc(...args),
  updateWeekPlanItemViaRpc: (...args: unknown[]) => updateWeekPlanItemViaRpc(...args),
  deleteWeekPlanItemViaRpc: (...args: unknown[]) => deleteWeekPlanItemViaRpc(...args),
  createSavedOutfitViaRpc: vi.fn(),
  updateSavedOutfitViaRpc: vi.fn(),
  deleteSavedOutfitViaRpc: vi.fn(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  upsertWeekPlanItemToSupabase.mockClear();
  deleteWeekPlanItemFromSupabase.mockClear();
  getCurrentUserId.mockClear().mockResolvedValue('user-1');
  fetchWeekPlanForReconciliation.mockClear().mockResolvedValue([]);
  createWeekPlanItemViaRpc.mockReset().mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: null });
  updateWeekPlanItemViaRpc.mockReset().mockResolvedValue({ status: 'applied', version: 2, deletedAt: null, content: null });
  deleteWeekPlanItemViaRpc.mockReset().mockResolvedValue({ status: 'applied', version: 3, deletedAt: '2026-01-01T00:00:00Z', content: null });
});

const INPUT = { anchorItemDescription: 'test', anchorItems: [] } as unknown as import('@/types/look-request').CreateLookInput;
const RECOMMENDATION = { tier: 'business', sketchImageUrl: null } as unknown as import('@/types/look-request').LookRecommendation;

describe('week-plan dual-write regression (mandatory)', () => {
  it('assigning an empty day invokes ONLY the version-aware create path — legacy upsertWeekPlanItemToSupabase is never called', async () => {
    const { assignOutfitToWeekDay, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignOutfitToWeekDay(dayKey, 'Monday', INPUT, RECOMMENDATION, 'req-1');
    await reconcileWeekPlan();

    expect(upsertWeekPlanItemToSupabase).toHaveBeenCalledTimes(0);
    expect(createWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
  });

  it('reassigning an already-assigned day invokes ONLY the version-aware update path — legacy upsert is never called', async () => {
    const { assignOutfitToWeekDay, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignOutfitToWeekDay(dayKey, 'Monday', INPUT, RECOMMENDATION, 'req-1');
    await reconcileWeekPlan();
    fetchWeekPlanForReconciliation.mockResolvedValue([
      { dayKey, dayLabel: 'Monday', requestId: 'req-1', assignedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION, syncVersion: 1, deletedAt: null },
    ]);
    upsertWeekPlanItemToSupabase.mockClear();

    await assignOutfitToWeekDay(dayKey, 'Monday', INPUT, RECOMMENDATION, 'req-2');
    await reconcileWeekPlan();

    expect(upsertWeekPlanItemToSupabase).toHaveBeenCalledTimes(0);
    expect(updateWeekPlanItemViaRpc).toHaveBeenCalledTimes(1);
    expect(createWeekPlanItemViaRpc).toHaveBeenCalledTimes(1); // only the first, original assignment
  });

  it('clearing a day invokes ONLY the version-aware CAS delete path — legacy physical delete is never called', async () => {
    const { assignOutfitToWeekDay, removeWeekPlan, getNextSevenDays } = await import('@/lib/week-plan-storage');
    const { reconcileWeekPlan } = await import('@/lib/week-plan-reconciliation');

    const dayKey = getNextSevenDays()[0]!.dayKey;
    await assignOutfitToWeekDay(dayKey, 'Monday', INPUT, RECOMMENDATION, 'req-1');
    await reconcileWeekPlan();
    fetchWeekPlanForReconciliation.mockResolvedValue([
      { dayKey, dayLabel: 'Monday', requestId: 'req-1', assignedAt: '2026-01-01T00:00:00Z', input: INPUT, recommendation: RECOMMENDATION, syncVersion: 1, deletedAt: null },
    ]);
    upsertWeekPlanItemToSupabase.mockClear();

    await removeWeekPlan(dayKey);
    await reconcileWeekPlan();

    expect(upsertWeekPlanItemToSupabase).not.toHaveBeenCalled();
    expect(deleteWeekPlanItemFromSupabase).not.toHaveBeenCalled();
    expect(deleteWeekPlanItemViaRpc).toHaveBeenCalledWith(dayKey, 1);
  });
});
