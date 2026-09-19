// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTravelPlannerForm } from '@/app/(app)/useTravelPlannerForm';

// ── What this file is ───────────────────────────────────────────────────────
//
// Focused on the itineraryDays state this hook gained for the "Have an
// itinerary?" upload/review feature — mirrors dayFormality's existing shape
// (a small editable per-day map, inline in this hook rather than a separate
// form hook). Not a full test of useTravelPlannerForm's many other
// pre-existing concerns, which remain untested as they were before this
// feature.

describe('useTravelPlannerForm — itineraryDays', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useTravelPlannerForm());
    expect(result.current.itineraryDays).toEqual([]);
  });

  it('replaceItineraryDays sets the full list', () => {
    const { result } = renderHook(() => useTravelPlannerForm());
    act(() => { result.current.replaceItineraryDays([{ date: '2026-09-24', summary: 'Conference' }]); });
    expect(result.current.itineraryDays).toEqual([{ date: '2026-09-24', summary: 'Conference' }]);
  });

  it('updateItineraryDaySummary edits only the matching day', () => {
    const { result } = renderHook(() => useTravelPlannerForm());
    act(() => {
      result.current.replaceItineraryDays([
        { date: '2026-09-24', summary: 'Conference' },
        { date: '2026-09-25', summary: 'Free day' },
      ]);
    });
    act(() => { result.current.updateItineraryDaySummary('2026-09-24', 'Conference, then dinner'); });

    expect(result.current.itineraryDays).toEqual([
      { date: '2026-09-24', summary: 'Conference, then dinner' },
      { date: '2026-09-25', summary: 'Free day' },
    ]);
  });

  it('removeItineraryDay removes only the matching day', () => {
    const { result } = renderHook(() => useTravelPlannerForm());
    act(() => {
      result.current.replaceItineraryDays([
        { date: '2026-09-24', summary: 'Conference' },
        { date: '2026-09-25', summary: 'Free day' },
      ]);
    });
    act(() => { result.current.removeItineraryDay('2026-09-24'); });

    expect(result.current.itineraryDays).toEqual([{ date: '2026-09-25', summary: 'Free day' }]);
  });

  it('resetForm clears itineraryDays', () => {
    const { result } = renderHook(() => useTravelPlannerForm());
    act(() => { result.current.replaceItineraryDays([{ date: '2026-09-24', summary: 'Conference' }]); });
    act(() => { result.current.resetForm(); });

    expect(result.current.itineraryDays).toEqual([]);
  });
});
