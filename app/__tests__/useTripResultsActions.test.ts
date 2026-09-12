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

const { updateDayMock } = vi.hoisted(() => ({ updateDayMock: vi.fn() }));
vi.mock('@/lib/trip-outfits-storage', () => ({ tripOutfitsStorage: { updateDay: updateDayMock } }));
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

// ── Fix: saved-trip sketch persistence ───────────────────────────────────────
//
// persistDay now branches on savedDbId (live state, updated the moment
// handleSaveTrip succeeds) instead of savedTripId (a frozen route param) —
// these tests protect that branch selection directly, plus the two
// regression scenarios the bug/fix report called out: mixed-sketch-day
// isolation and fresh-reload persistence via a stateful save/get mock.

function renderActionsWithSavedTripId(initialDays: TripOutfitDay[], savedTripId: string | undefined) {
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
      savedTripId,
      startSketchPoll: vi.fn(),
      stopSketchPoll: vi.fn(),
    }),
    { initialProps: { days } },
  );

  const sync = () => rerender({ days });
  return { result, sync, getDays: () => days };
}

describe('persistDay — savedDbId (live) vs savedTripId (frozen route param) branch selection', () => {
  it('an unsaved trip (no savedTripId on load) persists via tripOutfitsStorage, NOT savedTripsService', async () => {
    const day = fakeDay();
    const updatedDay = { ...day, sketchStatus: 'ready' as const, sketchUrl: 'https://example.com/a.jpg' };
    const { result } = renderActionsWithSavedTripId([day], undefined);

    await act(async () => {
      await result.current.persistDay('trip-1', updatedDay);
    });

    expect(updateDayMock).toHaveBeenCalledWith('trip-1', updatedDay);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('first-save-in-same-session: after handleSaveTrip succeeds, the NEXT persistDay call routes through savedTripsService — not tripOutfitsStorage', async () => {
    saveMock.mockResolvedValueOnce({ id: 'newly-saved-id', days: [] }); // handleSaveTrip's own save
    const day = fakeDay();
    const { result, sync } = renderActionsWithSavedTripId([day], undefined);

    expect(result.current.savedDbId).toBeNull();

    await act(async () => {
      await result.current.handleSaveTrip();
    });
    sync();
    expect(result.current.savedDbId).toBe('newly-saved-id');
    updateDayMock.mockClear();
    saveMock.mockClear();

    const updatedDay = { ...day, sketchStatus: 'ready' as const, sketchUrl: 'https://example.com/a.jpg' };
    saveMock.mockResolvedValueOnce({ id: 'newly-saved-id', days: [] });
    await act(async () => {
      await result.current.persistDay('trip-1', updatedDay);
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(updateDayMock).not.toHaveBeenCalled();
  });

  it('an already-saved trip (savedTripId present on load) persists via savedTripsService from the very first call', async () => {
    saveMock.mockResolvedValueOnce({ id: 'saved-1', days: [] });
    const day = fakeDay();
    const updatedDay = { ...day, sketchStatus: 'ready' as const, sketchUrl: 'https://example.com/a.jpg' };
    const { result } = renderActionsWithSavedTripId([day], 'saved-1');

    await act(async () => {
      await result.current.persistDay('trip-1', updatedDay);
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(updateDayMock).not.toHaveBeenCalled();
  });
});

describe('persistDay — mixed-sketch-day isolation (the reported bug scenario)', () => {
  it('generating Day A\'s sketch persists ONLY Day A — Day B\'s existing sketch is byte-identical in the save payload', async () => {
    saveMock.mockResolvedValueOnce({ id: 'saved-1', days: [] });
    const dayA = fakeDay({ id: 'day-a', sketchStatus: 'failed', sketchUrl: undefined });
    const dayB = fakeDay({ id: 'day-b', sketchStatus: 'ready', sketchUrl: 'https://example.com/b.jpg', sketchJobId: 'job-b' });
    const { result } = renderActionsWithSavedTripId([dayA, dayB], 'saved-1');

    const updatedDayA = { ...dayA, sketchStatus: 'ready' as const, sketchUrl: 'https://example.com/a.jpg', sketchJobId: 'job-a' };
    await act(async () => {
      await result.current.persistDay('trip-1', updatedDayA);
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    const payload = saveMock.mock.calls[0][0];
    const savedDayA = payload.days.find((d: TripOutfitDay) => d.id === 'day-a');
    const savedDayB = payload.days.find((d: TripOutfitDay) => d.id === 'day-b');
    expect(savedDayA.sketchUrl).toBe('https://example.com/a.jpg');
    expect(savedDayB).toEqual(dayB); // untouched, byte-identical to before
  });
});

describe('persistDay — fresh-reload proves real persistence (stateful save/get mock, not just React state)', () => {
  it('a sketch persisted for Day A is present on a SEPARATE, later read from the same backing store; Day B is unaffected', async () => {
    // A minimal in-memory stand-in for the backend's SavedTrip row: save()
    // writes into it, get() reads from that SAME variable — independent of
    // any React state, so this proves durability across a simulated reload
    // rather than merely proving setDays ran.
    const dayA = fakeDay({ id: 'day-a', sketchStatus: 'failed', sketchUrl: undefined });
    const dayB = fakeDay({ id: 'day-b', sketchStatus: 'ready', sketchUrl: 'https://example.com/b.jpg', sketchJobId: 'job-b' });
    let backingStore: { id: string; days: TripOutfitDay[] } = { id: 'saved-1', days: [dayA, dayB] };
    saveMock.mockImplementation(async (payload: { days: TripOutfitDay[] }) => {
      backingStore = { id: backingStore.id, days: payload.days };
      return backingStore;
    });
    const getById = async (id: string) => (id === backingStore.id ? backingStore : null);

    const { result } = renderActionsWithSavedTripId([dayA, dayB], 'saved-1');
    const updatedDayA = { ...dayA, sketchStatus: 'ready' as const, sketchUrl: 'https://example.com/a.jpg', sketchJobId: 'job-a' };

    await act(async () => {
      await result.current.persistDay('trip-1', updatedDayA);
    });

    // Discard all hook/screen state and re-fetch from the SAME backing store,
    // simulating a fresh saved-trip reload.
    const reloaded = await getById('saved-1');
    expect(reloaded).not.toBeNull();
    const reloadedDayA = reloaded!.days.find((d) => d.id === 'day-a');
    const reloadedDayB = reloaded!.days.find((d) => d.id === 'day-b');
    expect(reloadedDayA?.sketchUrl).toBe('https://example.com/a.jpg');
    expect(reloadedDayA?.sketchStatus).toBe('ready');
    expect(reloadedDayB).toEqual(dayB);
  });
});
