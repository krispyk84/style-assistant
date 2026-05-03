import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { closetService } from '@/services/closet';
import { savedTripsService } from '@/services/saved-trips';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';
import {
  buildPreviousTripDaysSummary,
  buildStoredTripPlanFromDraft,
  buildStoredTripPlanFromSavedTrip,
  buildTripDayGenerationParams,
} from './trip-results-mappers';

type UseTripResultsDataParams = {
  tripId?: string;
  savedTripId?: string;
  isProgressive: boolean;
};

export type TripResultsData = {
  plan: StoredTripPlan | null;
  setPlan: Dispatch<SetStateAction<StoredTripPlan | null>>;
  days: TripOutfitDay[];
  setDays: Dispatch<SetStateAction<TripOutfitDay[]>>;
  isLoading: boolean;
  errorMessage: string | null;
  progressDay: number;
  totalProgressDays: number;
  closetItems: ClosetItem[];
};

export function useTripResultsData({
  tripId,
  savedTripId,
  isProgressive,
}: UseTripResultsDataParams): TripResultsData {
  const [plan, setPlan] = useState<StoredTripPlan | null>(null);
  const [days, setDays] = useState<TripOutfitDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressDay, setProgressDay] = useState(0);
  const [totalProgressDays, setTotalProgressDays] = useState(0);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const progressiveRunning = useRef(false);

  useEffect(() => {
    closetService.getItems().then((res) => {
      if (res.success && res.data) setClosetItems(res.data.items ?? []);
    }).catch(() => {});
  }, []);

  const runProgressiveGeneration = useCallback(async (activeTripId: string) => {
    if (progressiveRunning.current) return;
    progressiveRunning.current = true;

    const draft = await tripDraftStorage.load().catch(() => null);
    if (!draft) {
      setErrorMessage('Trip details not found. Please go back and try again.');
      setIsLoading(false);
      progressiveRunning.current = false;
      return;
    }

    const totalDays = Math.min(8, draft.numDays);
    setTotalProgressDays(totalDays);
    setProgressDay(0);

    const planMeta = buildStoredTripPlanFromDraft(activeTripId, draft);
    await tripOutfitsStorage.save(planMeta);

    const generatedDays: TripOutfitDay[] = [];

    for (let index = 0; index < totalDays; index++) {
      setProgressDay(index);

      let result;
      try {
        result = await tripOutfitsService.generateTripOutfits(buildTripDayGenerationParams({
          tripId: activeTripId,
          draft,
          dayIndex: index,
          previousDaysSummary: buildPreviousTripDaysSummary(generatedDays),
        }));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Generation failed. Please go back and try again.');
        setIsLoading(false);
        progressiveRunning.current = false;
        return;
      }

      const newDay = result.days[0];
      if (!newDay) continue;

      generatedDays.push(newDay);
      setDays([...generatedDays]);

      if (index === 0) {
        setPlan({ ...planMeta, days: generatedDays });
        setIsLoading(false);
      }

      await tripOutfitsStorage.appendDay(activeTripId, newDay);
    }

    setPlan((prev) => prev ? { ...prev, days: generatedDays } : null);
    setTotalProgressDays(0);
    void tripDraftStorage.clear();
    progressiveRunning.current = false;
  }, []);

  useEffect(() => {
    if (!tripId && !savedTripId) {
      setErrorMessage('Missing trip ID.');
      setIsLoading(false);
      return;
    }

    if (savedTripId) {
      savedTripsService.getById(savedTripId).then((detail) => {
        const savedPlan = buildStoredTripPlanFromSavedTrip(detail);
        setPlan(savedPlan);
        setDays(detail.days);
        setIsLoading(false);
      }).catch(() => {
        setErrorMessage('Could not load saved trip. Please try again.');
        setIsLoading(false);
      });
      return;
    }

    if (isProgressive && tripId) {
      void runProgressiveGeneration(tripId);
      return;
    }

    if (!tripId) return;
    tripOutfitsStorage.load(tripId).then((loaded) => {
      if (!loaded) {
        setErrorMessage('Trip plan not found. Please go back and try again.');
      } else {
        setPlan(loaded);
        setDays(loaded.days);
      }
      setIsLoading(false);
    }).catch(() => {
      setErrorMessage('Could not load trip. Please go back and try again.');
      setIsLoading(false);
    });
  }, [isProgressive, runProgressiveGeneration, savedTripId, tripId]);

  return {
    plan,
    setPlan,
    days,
    setDays,
    isLoading,
    errorMessage,
    progressDay,
    totalProgressDays,
    closetItems,
  };
}
