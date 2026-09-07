// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TripDraft } from '@/lib/trip-draft-storage';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import type { TripOutfitDay } from '@/services/trip-outfits';

const { generateTripOutfitsMock, tripOutfitsStorageMock, tripDraftStorageMock, recordErrorMock } = vi.hoisted(() => ({
  generateTripOutfitsMock: vi.fn(),
  tripOutfitsStorageMock: { load: vi.fn(), save: vi.fn(), appendDay: vi.fn() },
  tripDraftStorageMock: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
  recordErrorMock: vi.fn(),
}));

vi.mock('@/services/trip-outfits', () => ({
  tripOutfitsService: { generateTripOutfits: generateTripOutfitsMock, getDaySketchStatus: vi.fn() },
}));
vi.mock('@/services/closet', () => ({
  closetService: { getItems: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }) },
}));
vi.mock('@/services/saved-trips', () => ({
  savedTripsService: { getById: vi.fn() },
}));
vi.mock('@/lib/trip-outfits-storage', () => ({ tripOutfitsStorage: tripOutfitsStorageMock }));
vi.mock('@/lib/trip-draft-storage', () => ({ tripDraftStorage: tripDraftStorageMock }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock, log: vi.fn() }));

const { useTripResultsData } = await import('@/app/useTripResultsData');

const TEST_DRAFT = {
  draftId: 'draft-1',
  destinationLabel: 'Lisbon, Portugal',
  country: 'Portugal',
  departureDate: '2026-06-01',
  returnDate: '2026-06-04',
  numDays: 3,
  travelParty: 'Solo',
  purposes: ['sightseeing'],
  climateLabel: 'Warm',
  styleVibe: 'Mix',
  willSwim: false,
  fancyNights: false,
  workoutClothes: false,
  laundryAccess: 'Unsure',
  shoesCount: '2',
  carryOnOnly: false,
  createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as TripDraft;

function fakeDay(id: string, dayIndex: number): TripOutfitDay {
  // pieces/shoes/closetItemIds are read by buildPreviousTripDaysSummary /
  // collectUsedOuterwear / collectUsedFootwear / collectUsedAnchorItemIds
  // when this day is used as context for generating a LATER day.
  return {
    id,
    dayIndex,
    date: `2026-06-0${dayIndex + 1}`,
    dayType: 'sightseeing',
    pieces: [],
    shoes: null,
    closetItemIds: [],
  } as unknown as TripOutfitDay;
}

function fakePlan(tripId: string, days: TripOutfitDay[]): StoredTripPlan {
  return {
    tripId,
    destination: 'Lisbon, Portugal',
    country: 'Portugal',
    climateLabel: 'Warm',
    styleVibe: 'Mix',
    purposes: ['sightseeing'],
    days,
    generatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as StoredTripPlan;
}

beforeEach(() => {
  vi.clearAllMocks();
  tripDraftStorageMock.load.mockResolvedValue(TEST_DRAFT);
  tripOutfitsStorageMock.load.mockResolvedValue(null);
  tripOutfitsStorageMock.save.mockResolvedValue(undefined);
  tripOutfitsStorageMock.appendDay.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTripResultsData — progressive generation resume behavior', () => {
  it('no previously generated days: generates every day starting at index 0', async () => {
    generateTripOutfitsMock.mockImplementation(async (params: { generateOnlyDayIndex: number }) => ({
      days: [fakeDay(`day-${params.generateOnlyDayIndex}`, params.generateOnlyDayIndex)],
    }));

    const { result } = renderHook(() => useTripResultsData({ tripId: 'trip-1', isProgressive: true }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.days).toHaveLength(3));

    expect(generateTripOutfitsMock).toHaveBeenCalledTimes(3);
    expect(generateTripOutfitsMock.mock.calls.map((c) => c[0].generateOnlyDayIndex)).toEqual([0, 1, 2]);
    expect(result.current.errorMessage).toBeNull();
  });

  it('some days already completed: resumes from the correct next day instead of restarting at 0', async () => {
    tripOutfitsStorageMock.load.mockResolvedValue(fakePlan('trip-1', [fakeDay('day-0', 0), fakeDay('day-1', 1)]));
    generateTripOutfitsMock.mockImplementation(async (params: { generateOnlyDayIndex: number }) => ({
      days: [fakeDay(`day-${params.generateOnlyDayIndex}`, params.generateOnlyDayIndex)],
    }));

    const { result } = renderHook(() => useTripResultsData({ tripId: 'trip-1', isProgressive: true }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.days).toHaveLength(3));

    // Only day 2 needed generating — days 0 and 1 came from the persisted plan.
    expect(generateTripOutfitsMock).toHaveBeenCalledTimes(1);
    expect(generateTripOutfitsMock.mock.calls[0]![0].generateOnlyDayIndex).toBe(2);
    // The already-persisted plan was never re-saved from scratch.
    expect(tripOutfitsStorageMock.save).not.toHaveBeenCalled();
  });

  it('all days already completed (remount after a finished run): does not regenerate anything', async () => {
    tripOutfitsStorageMock.load.mockResolvedValue(
      fakePlan('trip-1', [fakeDay('day-0', 0), fakeDay('day-1', 1), fakeDay('day-2', 2)]),
    );

    const { result } = renderHook(() => useTripResultsData({ tripId: 'trip-1', isProgressive: true }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(generateTripOutfitsMock).not.toHaveBeenCalled();
    expect(result.current.days).toHaveLength(3);
    expect(tripDraftStorageMock.clear).toHaveBeenCalled();
  });

  it('failure on a middle day stops the loop, surfaces an error, and does not incorrectly advance progress', async () => {
    generateTripOutfitsMock.mockImplementation(async (params: { generateOnlyDayIndex: number }) => {
      if (params.generateOnlyDayIndex === 1) throw new Error('Generation failed for day 1');
      return { days: [fakeDay(`day-${params.generateOnlyDayIndex}`, params.generateOnlyDayIndex)] };
    });

    const { result } = renderHook(() => useTripResultsData({ tripId: 'trip-1', isProgressive: true }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorMessage).toBe('Generation failed for day 1');
    // Day 0 succeeded and should be visible; day 2 must never have been attempted.
    expect(result.current.days.map((d) => d.id)).toEqual(['day-0']);
    expect(generateTripOutfitsMock).toHaveBeenCalledTimes(2); // day 0 (success), day 1 (failure) — never day 2
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'trip_progressive_generation_day_failed');
    // The failed day was never persisted.
    expect(tripOutfitsStorageMock.appendDay).toHaveBeenCalledTimes(1);
    expect(tripOutfitsStorageMock.appendDay).toHaveBeenCalledWith('trip-1', expect.objectContaining({ id: 'day-0' }));
  });

  it('a still-in-flight generation ignores a second trigger rather than racing it (progressiveRunning guard)', async () => {
    let resolveFirstDay!: (value: { days: TripOutfitDay[] }) => void;
    generateTripOutfitsMock.mockImplementation(
      () => new Promise((resolve) => { resolveFirstDay = resolve; }),
    );

    const { result, rerender } = renderHook(
      ({ tripId }) => useTripResultsData({ tripId, isProgressive: true }),
      { initialProps: { tripId: 'trip-1' } },
    );

    await waitFor(() => expect(generateTripOutfitsMock).toHaveBeenCalledTimes(1));

    // Re-render as if the screen were reused for a different trip while the
    // first trip's generation is still awaiting its first day — the guard
    // (progressiveRunning.current) must refuse the new trigger rather than
    // letting two generations interleave and corrupt each other's state.
    rerender({ tripId: 'trip-2' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(generateTripOutfitsMock).toHaveBeenCalledTimes(1); // still just the trip-1 call — trip-2 was refused, not started

    act(() => resolveFirstDay({ days: [fakeDay('day-0', 0)] }));
    await waitFor(() => expect(result.current.days.length).toBeGreaterThan(0));
  });
});
