import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 2B1 (sync redesign): proves (1) the fix to a real, previously-latent
// gap — fetchSavedOutfitsFromSupabase/fetchWeekPlanFromSupabase had NO
// deleted_at filter at all, so a tombstoned row would have shown up as live
// — and (2) the new reconciliation-only reads that DO include tombstones
// plus syncVersion/deletedAt, per docs/sync-phase2a-reconciliation-spec.md §F.
// Same module-mocking rationale as supabase-data-contract.test.ts: the real
// supabase client constructs a RealtimeClient at import time that throws
// under plain Node.

const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: getSessionMock },
    from: fromMock,
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

// Thenable at every step (real supabase-js query builders are thenable
// regardless of how many filters have been chained) — .is()/.order() just
// return the same chain, so both call shapes this file needs
// (.select().is().order() for the ordinary reads, bare .select() for the
// reconciliation reads) resolve to the configured result whenever awaited.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
});

const LIVE_ROW = {
  id: 'req-1:business',
  user_id: 'user-1',
  request_id: 'req-1',
  saved_at: '2026-01-01T00:00:00.000Z',
  input: { a: 1 },
  recommendation: { b: 1 },
  sync_version: 3,
  deleted_at: null,
};

const TOMBSTONE_ROW = {
  ...LIVE_ROW,
  id: 'req-2:business',
  sync_version: 5,
  deleted_at: '2026-02-01T00:00:00.000Z',
};

describe('fetchSavedOutfitsFromSupabase — ordinary read (Phase 2B1 filter fix)', () => {
  it('filters deleted_at IS NULL — the fix for a previously-latent gap where no filter existed at all', async () => {
    const chain = makeChain({ data: [LIVE_ROW], error: null });
    fromMock.mockReturnValue({ select: vi.fn(() => chain) });

    const { fetchSavedOutfitsFromSupabase } = await import('@/lib/supabase-data');
    const result = await fetchSavedOutfitsFromSupabase();

    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(result).toEqual([{ id: 'req-1:business', requestId: 'req-1', savedAt: LIVE_ROW.saved_at, input: { a: 1 }, recommendation: { b: 1 } }]);
    // No sync bookkeeping in the ordinary domain-object shape.
    expect(result[0]).not.toHaveProperty('syncVersion');
    expect(result[0]).not.toHaveProperty('deletedAt');
  });
});

describe('fetchSavedOutfitsForReconciliation — tombstone-inclusive, version-carrying read', () => {
  it('does NOT filter deleted_at — a tombstoned row is returned, not hidden', async () => {
    const chain = makeChain({ data: [LIVE_ROW, TOMBSTONE_ROW], error: null });
    fromMock.mockReturnValue({ select: vi.fn(() => chain) });

    const { fetchSavedOutfitsForReconciliation } = await import('@/lib/supabase-data');
    const result = await fetchSavedOutfitsForReconciliation();

    expect(chain.is).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'req-1:business', requestId: 'req-1', savedAt: LIVE_ROW.saved_at, input: { a: 1 }, recommendation: { b: 1 }, syncVersion: 3, deletedAt: null },
      { id: 'req-2:business', requestId: 'req-1', savedAt: LIVE_ROW.saved_at, input: { a: 1 }, recommendation: { b: 1 }, syncVersion: 5, deletedAt: '2026-02-01T00:00:00.000Z' },
    ]);
  });

  it('returns an empty array on error rather than throwing (matches every other fetch* function\'s existing contract)', async () => {
    const chain = makeChain({ data: null, error: { message: 'boom' } });
    fromMock.mockReturnValue({ select: vi.fn(() => chain) });

    const { fetchSavedOutfitsForReconciliation } = await import('@/lib/supabase-data');
    await expect(fetchSavedOutfitsForReconciliation()).resolves.toEqual([]);
  });
});

const WEEK_LIVE_ROW = {
  user_id: 'user-1',
  day_key: 'mon',
  day_label: 'Monday',
  request_id: 'req-mon',
  assigned_at: '2026-01-05T00:00:00.000Z',
  input: { a: 1 },
  recommendation: { b: 1 },
  sync_version: 2,
  deleted_at: null,
};

const WEEK_TOMBSTONE_ROW = {
  ...WEEK_LIVE_ROW,
  day_key: 'tue',
  sync_version: 4,
  deleted_at: '2026-02-02T00:00:00.000Z',
};

describe('fetchWeekPlanFromSupabase — ordinary read (Phase 2B1 filter fix)', () => {
  it('filters deleted_at IS NULL', async () => {
    const chain = makeChain({ data: [WEEK_LIVE_ROW], error: null });
    fromMock.mockReturnValue({ select: vi.fn(() => chain) });

    const { fetchWeekPlanFromSupabase } = await import('@/lib/supabase-data');
    const result = await fetchWeekPlanFromSupabase();

    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(result).toEqual([{ dayKey: 'mon', dayLabel: 'Monday', requestId: 'req-mon', assignedAt: WEEK_LIVE_ROW.assigned_at, input: { a: 1 }, recommendation: { b: 1 } }]);
  });
});

describe('fetchWeekPlanForReconciliation — tombstone-inclusive, version-carrying read', () => {
  it('does NOT filter deleted_at and maps syncVersion/deletedAt', async () => {
    const chain = makeChain({ data: [WEEK_LIVE_ROW, WEEK_TOMBSTONE_ROW], error: null });
    fromMock.mockReturnValue({ select: vi.fn(() => chain) });

    const { fetchWeekPlanForReconciliation } = await import('@/lib/supabase-data');
    const result = await fetchWeekPlanForReconciliation();

    expect(chain.is).not.toHaveBeenCalled();
    expect(result).toEqual([
      { dayKey: 'mon', dayLabel: 'Monday', requestId: 'req-mon', assignedAt: WEEK_LIVE_ROW.assigned_at, input: { a: 1 }, recommendation: { b: 1 }, syncVersion: 2, deletedAt: null },
      { dayKey: 'tue', dayLabel: 'Monday', requestId: 'req-mon', assignedAt: WEEK_LIVE_ROW.assigned_at, input: { a: 1 }, recommendation: { b: 1 }, syncVersion: 4, deletedAt: '2026-02-02T00:00:00.000Z' },
    ]);
  });
});
