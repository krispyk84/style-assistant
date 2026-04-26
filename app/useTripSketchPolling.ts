import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';

import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';

type UseTripSketchPollingParams = {
  setDays: Dispatch<SetStateAction<TripOutfitDay[]>>;
};

export function useTripSketchPolling({ setDays }: UseTripSketchPollingParams) {
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stopSketchPoll = useCallback((dayId: string) => {
    if (!pollIntervals.current[dayId]) return;
    clearInterval(pollIntervals.current[dayId]);
    delete pollIntervals.current[dayId];
  }, []);

  const startSketchPoll = useCallback((dayId: string, jobId: string, tripId: string) => {
    stopSketchPoll(dayId);

    pollIntervals.current[dayId] = setInterval(async () => {
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
          if (updatedDay) await tripOutfitsStorage.updateDay(tripId, updatedDay);
        } else if (status.sketchStatus === 'failed') {
          stopSketchPoll(dayId);
          setDays((prev) =>
            prev.map((day) => (day.id === dayId ? { ...day, sketchStatus: 'failed' } : day))
          );
        }
      } catch {
        // Network glitch: keep polling.
      }
    }, 4000);
  }, [setDays, stopSketchPoll]);

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
