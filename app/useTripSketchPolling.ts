import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef } from 'react';

import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { PersistDayFn } from './useTripResultsActions';

type UseTripSketchPollingParams = {
  setDays: Dispatch<SetStateAction<TripOutfitDay[]>>;
  // Bridges to useTripResultsActions' persistDay — the screen keeps this ref
  // current (see TripResultsScreen.tsx) so a poll tick always calls whatever
  // persistDay implementation exists NOW, never a copy captured back when
  // startSketchPoll's setInterval was first created. persistDay itself
  // already owns the saved-trip-vs-local-storage branch; this hook never
  // decides that, it just calls through the ref.
  persistDayRef: MutableRefObject<PersistDayFn>;
};

export function useTripSketchPolling({ setDays, persistDayRef }: UseTripSketchPollingParams) {
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // Per-day in-flight guard — setInterval doesn't wait for its async callback,
  // so a slow getDaySketchStatus call could otherwise still be pending when
  // the next tick fires, letting two overlap.
  const pollInFlight = useRef<Record<string, boolean>>({});

  const stopSketchPoll = useCallback((dayId: string) => {
    if (!pollIntervals.current[dayId]) return;
    clearInterval(pollIntervals.current[dayId]);
    delete pollIntervals.current[dayId];
    delete pollInFlight.current[dayId];
  }, []);

  const startSketchPoll = useCallback((dayId: string, jobId: string, tripId: string) => {
    stopSketchPoll(dayId);

    pollIntervals.current[dayId] = setInterval(async () => {
      if (pollInFlight.current[dayId]) return;
      pollInFlight.current[dayId] = true;
      try {
        const status = await tripOutfitsService.getDaySketchStatus(jobId);

        if (status.sketchStatus === 'ready' && status.sketchImageUrl) {
          stopSketchPoll(dayId);

          const sketchUrl = status.sketchImageUrl;
          let updatedDay: TripOutfitDay | undefined;
          setDays((prev) => {
            const next = prev.map((day) => {
              if (day.id !== dayId) return day;
              updatedDay = { ...day, sketchStatus: 'ready', sketchUrl, sketchJobId: jobId };
              return updatedDay;
            });
            return next;
          });
          if (updatedDay) await persistDayRef.current(tripId, updatedDay);
        } else if (status.sketchStatus === 'failed') {
          stopSketchPoll(dayId);
          setDays((prev) =>
            prev.map((day) => (day.id === dayId ? { ...day, sketchStatus: 'failed' } : day))
          );
        }
      } catch {
        // Network glitch: keep polling.
      } finally {
        pollInFlight.current[dayId] = false;
      }
    }, 4000);
  }, [setDays, stopSketchPoll, persistDayRef]);

  useEffect(() => {
    const intervals = pollIntervals.current;
    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, []);

  return {
    startSketchPoll,
    stopSketchPoll,
  };
}
