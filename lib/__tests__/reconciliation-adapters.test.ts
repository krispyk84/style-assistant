import { describe, expect, it, vi } from 'vitest';

// Proves Part 15's deliberate content-equality decision for all four
// domain adapters: each domain's own "when this happened" business
// timestamp (savedAt / assignedAt) is excluded from equality; everything
// else that describes the actual assignment/save is included. Same
// module-mocking rationale as this session's other lib/*.test.ts files —
// the real @/lib/supabase client constructs a RealtimeClient at import
// time that throws under plain Node; not exercised by these tests anyway
// (compareContent is pure, no network).

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn() } } }));
vi.mock('@/lib/api/api-client', () => ({ createApiClient: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: vi.fn(), log: vi.fn() }));

const {
  savedOutfitAdapter,
  weekPlanAdapter,
  closetOutfitFavouriteAdapter,
  closetOutfitWeekPlanAdapter,
} = await import('@/lib/reconciliation-adapters');

type SavedOutfitLike = import('@/types/style').SavedOutfit;
type WeekPlannedOutfitLike = import('@/types/style').WeekPlannedOutfit;

describe('savedOutfitAdapter.compareContent', () => {
  const base = { id: 'x', requestId: 'req-1', savedAt: '2026-01-01T00:00:00Z', input: { a: 1 }, recommendation: { b: 1 } } as unknown as SavedOutfitLike;

  it('DELIBERATE CHOICE: differing savedAt alone (same everything else) is still equal', () => {
    const other = { ...base, savedAt: '2026-06-01T00:00:00Z' } as unknown as SavedOutfitLike;
    expect(savedOutfitAdapter.compareContent(base, other)).toBe(true);
  });

  it('differing recommendation content is NOT equal, even with identical savedAt', () => {
    const other = { ...base, recommendation: { b: 2 } } as unknown as SavedOutfitLike;
    expect(savedOutfitAdapter.compareContent(base, other)).toBe(false);
  });

  it('differing input content is NOT equal', () => {
    const other = { ...base, input: { a: 2 } } as unknown as SavedOutfitLike;
    expect(savedOutfitAdapter.compareContent(base, other)).toBe(false);
  });
});

describe('weekPlanAdapter.compareContent', () => {
  const base = { dayKey: 'mon', dayLabel: 'Monday', requestId: 'req-1', assignedAt: '2026-01-05T00:00:00Z', input: { a: 1 }, recommendation: { b: 1 } } as unknown as WeekPlannedOutfitLike;

  it('DELIBERATE CHOICE: differing assignedAt alone is still equal — the same outfit assigned to the same day is the same content for sync purposes regardless of clock reading', () => {
    const other = { ...base, assignedAt: '2026-01-06T00:00:00Z' } as unknown as WeekPlannedOutfitLike;
    expect(weekPlanAdapter.compareContent(base, other)).toBe(true);
  });

  it('differing dayLabel (a real, user-visible difference) is NOT equal', () => {
    const other = { ...base, dayLabel: 'Tuesday' } as unknown as WeekPlannedOutfitLike;
    expect(weekPlanAdapter.compareContent(base, other)).toBe(false);
  });

  it('differing recommendation content is NOT equal', () => {
    const other = { ...base, recommendation: { b: 2 } } as unknown as WeekPlannedOutfitLike;
    expect(weekPlanAdapter.compareContent(base, other)).toBe(false);
  });
});

describe('closetOutfitFavouriteAdapter.compareContent', () => {
  const base = { id: 'f1', formality: 'business' as const, outfit: { id: 'o1' } as never, savedAt: '2026-01-01T00:00:00Z' };

  it('differing savedAt alone is still equal', () => {
    expect(closetOutfitFavouriteAdapter.compareContent(base, { ...base, savedAt: '2026-02-01T00:00:00Z' })).toBe(true);
  });

  it('differing outfit content is NOT equal', () => {
    expect(closetOutfitFavouriteAdapter.compareContent(base, { ...base, outfit: { id: 'o2' } as never })).toBe(false);
  });

  it('differing formality is NOT equal', () => {
    expect(closetOutfitFavouriteAdapter.compareContent(base, { ...base, formality: 'casual' as const })).toBe(false);
  });
});

describe('closetOutfitWeekPlanAdapter.compareContent', () => {
  const base = { dayKey: 'mon', dayLabel: 'Monday', formality: 'business' as const, outfit: { id: 'o1' } as never, assignedAt: '2026-01-05T00:00:00Z' };

  it('differing assignedAt alone is still equal', () => {
    expect(closetOutfitWeekPlanAdapter.compareContent(base, { ...base, assignedAt: '2026-01-06T00:00:00Z' })).toBe(true);
  });

  it('differing outfit content is NOT equal', () => {
    expect(closetOutfitWeekPlanAdapter.compareContent(base, { ...base, outfit: { id: 'o2' } as never })).toBe(false);
  });
});
