// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';

import type { TripOutfitDay } from '@/services/trip-outfits';
import type { PersistDayFn } from '@/app/useTripResultsActions';

// Fix: saved-trip sketch persistence. useTripSketchPolling used to persist a
// completed sketch straight to tripOutfitsStorage, unconditionally — the
// wrong destination for an already-saved trip, since saved-trip reloads
// fetch fresh from the backend and never read that local store. The fix
// routes the completed sketch through a persistDayRef the screen keeps
// pointed at the CURRENT useTripResultsActions.persistDay (which already
// owns the saved-vs-local branch) instead of a hardcoded storage call. These
// tests protect that ref-based hand-off specifically — persistDay's own
// branch/failure/revert behavior is covered by useTripResultsActions.test.ts.

const { getDaySketchStatusMock } = vi.hoisted(() => ({ getDaySketchStatusMock: vi.fn() }));
vi.mock('@/services/trip-outfits', () => ({ tripOutfitsService: { getDaySketchStatus: getDaySketchStatusMock } }));

const { useTripSketchPolling } = await import('@/app/useTripSketchPolling');

function fakeDay(overrides: Partial<TripOutfitDay> = {}): TripOutfitDay {
  return {
    id: 'day-1',
    dayIndex: 0,
    date: '2026-06-01',
    dayType: 'sightseeing',
    pieces: [],
    shoes: null,
    sketchStatus: 'loading',
    feedback: null,
    ...overrides,
  } as unknown as TripOutfitDay;
}

function renderPolling(initialDays: TripOutfitDay[], persistDayImpl: PersistDayFn) {
  let days = initialDays;
  const setDays = vi.fn((updater: TripOutfitDay[] | ((prev: TripOutfitDay[]) => TripOutfitDay[])) => {
    days = typeof updater === 'function' ? (updater as (prev: TripOutfitDay[]) => TripOutfitDay[])(days) : updater;
  });

  const { result } = renderHook(() => {
    const persistDayRef = useRef<PersistDayFn>(persistDayImpl);
    persistDayRef.current = persistDayImpl;
    const polling = useTripSketchPolling({ setDays, persistDayRef });
    return { ...polling, persistDayRef };
  });

  return { result, getDays: () => days };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTripSketchPolling — persistDayRef hand-off', () => {
  it('sketch ready: persistDayRef.current is called with the completed day, keyed by tripId', async () => {
    getDaySketchStatusMock.mockResolvedValue({ sketchStatus: 'ready', sketchImageUrl: 'https://example.com/sketch.jpg' });
    const persistDay = vi.fn().mockResolvedValue(undefined);
    const day = fakeDay();
    const { result } = renderPolling([day], persistDay);

    act(() => {
      result.current.startSketchPoll(day.id, 'job-1', 'trip-1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(persistDay).toHaveBeenCalledTimes(1);
    expect(persistDay).toHaveBeenCalledWith('trip-1', expect.objectContaining({
      id: day.id,
      sketchStatus: 'ready',
      sketchUrl: 'https://example.com/sketch.jpg',
      sketchJobId: 'job-1',
    }));
  });

  it('sketch failed: persistDayRef.current is NEVER called — no broken reference is persisted', async () => {
    getDaySketchStatusMock.mockResolvedValue({ sketchStatus: 'failed', sketchImageUrl: null });
    const persistDay = vi.fn().mockResolvedValue(undefined);
    const day = fakeDay();
    const { result } = renderPolling([day], persistDay);

    act(() => {
      result.current.startSketchPoll(day.id, 'job-1', 'trip-1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(persistDay).not.toHaveBeenCalled();
  });

  it('stale-closure safety: the poll calls the LATEST persistDayRef value at resolution time, not the one captured when polling started', async () => {
    // Pending on the first tick, ready on the second — gives us a window to
    // swap the ref's target in between, proving the poll doesn't capture a
    // stale persistDay closure from when startSketchPoll was first called.
    getDaySketchStatusMock
      .mockResolvedValueOnce({ sketchStatus: 'pending', sketchImageUrl: null })
      .mockResolvedValueOnce({ sketchStatus: 'ready', sketchImageUrl: 'https://example.com/sketch.jpg' });

    const persistDayA = vi.fn().mockResolvedValue(undefined);
    const persistDayB = vi.fn().mockResolvedValue(undefined);
    const day = fakeDay();

    let days = [day];
    const setDays = vi.fn((updater: TripOutfitDay[] | ((prev: TripOutfitDay[]) => TripOutfitDay[])) => {
      days = typeof updater === 'function' ? (updater as (prev: TripOutfitDay[]) => TripOutfitDay[])(days) : updater;
    });

    const persistDayRef = { current: persistDayA as PersistDayFn };
    const { result } = renderHook(() => useTripSketchPolling({ setDays, persistDayRef }));

    act(() => {
      result.current.startSketchPoll(day.id, 'job-1', 'trip-1');
    });

    // First tick: still pending — no persistence attempted yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(persistDayA).not.toHaveBeenCalled();

    // Swap the ref's target exactly the way TripResultsScreen's effect does
    // when useTripResultsActions recreates persistDay (e.g. after `days` changes).
    persistDayRef.current = persistDayB;

    // Second tick: now ready.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(persistDayB).toHaveBeenCalledTimes(1);
    expect(persistDayA).not.toHaveBeenCalled();
  });

  it('sibling isolation: a poll for one day never invokes persistDayRef for a different day\'s id', async () => {
    getDaySketchStatusMock.mockImplementation(async (jobId: string) =>
      jobId === 'job-a'
        ? { sketchStatus: 'ready', sketchImageUrl: 'https://example.com/a.jpg' }
        : { sketchStatus: 'pending', sketchImageUrl: null },
    );
    const persistDay = vi.fn().mockResolvedValue(undefined);
    const dayA = fakeDay({ id: 'day-a' });
    const dayB = fakeDay({ id: 'day-b' });
    const { result } = renderPolling([dayA, dayB], persistDay);

    act(() => {
      result.current.startSketchPoll('day-a', 'job-a', 'trip-1');
      result.current.startSketchPoll('day-b', 'job-b', 'trip-1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(persistDay).toHaveBeenCalledTimes(1);
    expect(persistDay).toHaveBeenCalledWith('trip-1', expect.objectContaining({ id: 'day-a' }));
  });
});
