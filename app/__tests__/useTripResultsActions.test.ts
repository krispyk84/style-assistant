// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import type { TripOutfitDay } from '@/services/trip-outfits';

// Phase -1 fix: persistDay's cloud-write catch was previously empty
// (`.catch(() => {})`), so a save failure for an already-saved trip's day
// edit was invisible — the optimistic setDays(...) already showed the
// edit as if it had taken, and only a later reload would silently revert
// it, with nothing logged anywhere in between. These tests exercise the
// fixed persistDay indirectly through handleLove, the simplest of its six
// callers (a single setDays + persistDay call, no other side effects).

// expo-router's real module tree includes .tsx layout components not needed
// here (useTripResultsActions only uses `router.push`, in a handler this file
// never calls) — mocked out entirely to avoid pulling in JSX vitest isn't
// configured to transform for this plain-Node test file.
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));

const { saveMock } = vi.hoisted(() => ({ saveMock: vi.fn() }));
vi.mock('@/services/saved-trips', () => ({ savedTripsService: { save: saveMock } }));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock, log: vi.fn() }));

vi.mock('@/lib/trip-outfits-storage', () => ({ tripOutfitsStorage: { updateDay: vi.fn() } }));
vi.mock('@/services/trip-outfits', () => ({ tripOutfitsService: {} }));
vi.mock('@/lib/trip-day-variant-flow', () => ({
  tripDayVariantFlow: { setPendingRequest: vi.fn(), setListener: vi.fn(), clearListener: vi.fn() },
}));

const { useTripResultsActions } = await import('@/app/useTripResultsActions');

const FAKE_PLAN = {
  tripId: 'trip-1',
  destination: 'Lisbon, Portugal',
  country: 'Portugal',
  climateLabel: 'Warm',
  styleVibe: 'Mix',
  purposes: ['sightseeing'],
} as unknown as StoredTripPlan;

function fakeDay(overrides: Partial<TripOutfitDay> = {}): TripOutfitDay {
  return {
    id: 'day-1',
    dayIndex: 0,
    date: '2026-06-01',
    dayType: 'sightseeing',
    pieces: [],
    shoes: null,
    sketchStatus: 'ready',
    feedback: null,
    ...overrides,
  } as unknown as TripOutfitDay;
}

function renderActions(initialDays: TripOutfitDay[]) {
  let days = initialDays;
  const setDays = vi.fn((updater: TripOutfitDay[] | ((prev: TripOutfitDay[]) => TripOutfitDay[])) => {
    days = typeof updater === 'function' ? (updater as (prev: TripOutfitDay[]) => TripOutfitDay[])(days) : updater;
  });

  const { result, rerender } = renderHook(
    (props: { days: TripOutfitDay[] }) => useTripResultsActions({
      plan: FAKE_PLAN,
      days: props.days,
      setDays,
      tripId: 'trip-1',
      savedTripId: 'saved-1',
      startSketchPoll: vi.fn(),
      stopSketchPoll: vi.fn(),
    }),
    { initialProps: { days } },
  );

  // Keeps the hook's `days` in sync with what setDays produced, mirroring how
  // the real screen re-renders with updated state after every setDays call.
  const sync = () => rerender({ days });
  return { result, sync, getDays: () => days };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('persistDay (via handleLove) — saved-trip day-edit reliability', () => {
  it('SUCCESS: the loved day persists and remains visible', async () => {
    saveMock.mockResolvedValue({ id: 'saved-1', days: [] });
    const day = fakeDay({ feedback: null });
    const { result, sync, getDays } = renderActions([day]);

    await act(async () => {
      await result.current.handleLove(day);
    });
    sync();

    expect(getDays()[0]?.feedback).toBe('love');
    expect(recordErrorMock).not.toHaveBeenCalled();
  });

  it('REJECTED PROMISE: the optimistic edit is reverted, not left as phantom state', async () => {
    saveMock.mockRejectedValue(new Error('network down'));
    const day = fakeDay({ feedback: null });
    const { result, sync, getDays } = renderActions([day]);

    await act(async () => {
      await result.current.handleLove(day);
    });
    sync();

    // Reverted back to null, not left showing 'love' as if the save had succeeded.
    expect(getDays()[0]?.feedback).toBeNull();
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'saved_trip_day_persist_failed');
  });

  it('RESOLVED FAILURE ({success:false}, collapsed into a throw by savedTripsService itself): same revert, same logging', async () => {
    // savedTripsService.save already converts a resolved {success:false} API
    // response into a thrown Error (api-saved-trips-service.ts) — this proves
    // persistDay's catch handles that origin identically to a network rejection.
    saveMock.mockRejectedValue(new Error('Failed to save trip.'));
    const day = fakeDay({ feedback: null });
    const { result, sync, getDays } = renderActions([day]);

    await act(async () => {
      await result.current.handleLove(day);
    });
    sync();

    expect(getDays()[0]?.feedback).toBeNull();
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'saved_trip_day_persist_failed');
  });

  it('retry remains possible: a failed save followed by a successful retry ends up persisted', async () => {
    saveMock.mockRejectedValueOnce(new Error('network down'));
    saveMock.mockResolvedValueOnce({ id: 'saved-1', days: [] });

    const day = fakeDay({ feedback: null });
    const { result, sync, getDays } = renderActions([day]);

    await act(async () => {
      await result.current.handleLove(day);
    });
    sync();
    expect(getDays()[0]?.feedback).toBeNull(); // reverted after the first failure

    await act(async () => {
      await result.current.handleLove(getDays()[0]!);
    });
    sync();
    expect(getDays()[0]?.feedback).toBe('love'); // succeeds on retry
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
