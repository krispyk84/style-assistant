import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

import { recordError } from '@/lib/crashlytics';
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
  collectUsedAnchorItemIds,
  collectUsedFootwear,
  collectUsedOuterwear,
  computeTripGenerationResumePoint,
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
    }).catch((error) => recordError(error, 'trip_results_closet_items_load'));
  }, []);

  // Wrapped in an outer try/catch/finally so ANY throw here — including from
  // tripOutfitsStorage.save/appendDay below, not just the per-day generation
  // call — logs, surfaces a message, and clears isLoading/progressiveRunning.
  // Before this fix, a throw from those storage calls left the caller
  // (`void runProgressiveGeneration(tripId)`, uncaught) on an infinite
  // spinner with progressiveRunning stuck true forever.
  const runProgressiveGeneration = useCallback(async (activeTripId: string) => {
    if (progressiveRunning.current) return;
    progressiveRunning.current = true;

    try {
      const draft = await tripDraftStorage.load().catch(() => null);
      if (!draft) {
        setErrorMessage('Trip details not found. Please go back and try again.');
        setIsLoading(false);
        return;
      }

      // Resume rather than restart from day 0 if a previous run for this
      // exact tripId already generated some days. The realistic trigger is a
      // cold app relaunch mid-generation (backgrounded, OS reclaims memory,
      // Expo Router restores this same route from its persisted nav state) —
      // a fresh process, one instance, no live race, just resuming from what
      // was already persisted instead of silently re-running (and re-billing)
      // completed days. Investigated 2026-09-07 (Maintenance Checkpoint 5)
      // whether a live cross-invocation race (two instances for the same
      // tripId genuinely running at once) is reachable via normal navigation:
      // it isn't — createTripId() stamps a fresh id from Date.now() on every
      // "Build"/"Continue" tap, and the only screen that can reopen an
      // EXISTING tripId (TravelPlannerScreen's saved-trips list) does so via
      // savedTripId, a different code path entirely that never sets
      // isProgressiveGeneration. No cross-invocation lock added — there's
      // nothing currently reachable for it to guard against; revisit if a
      // future entry point ever lets a user navigate back into an
      // already-generating (not-yet-saved) trip by its original tripId.
      const existingPlan = await tripOutfitsStorage.load(activeTripId).catch(() => null);
      const generatedDays: TripOutfitDay[] = existingPlan?.days ? [...existingPlan.days] : [];
      const { totalDays, isAlreadyComplete } = computeTripGenerationResumePoint({
        numDays: draft.numDays,
        existingDays: existingPlan?.days,
      });

      if (isAlreadyComplete && existingPlan) {
        setTotalProgressDays(0);
        setPlan(existingPlan);
        setDays(generatedDays);
        setIsLoading(false);
        void tripDraftStorage.clear();
        return;
      }

      setTotalProgressDays(totalDays);
      setProgressDay(generatedDays.length);

      const planMeta = existingPlan ?? buildStoredTripPlanFromDraft(activeTripId, draft);
      if (!existingPlan) await tripOutfitsStorage.save(planMeta);

      if (generatedDays.length > 0) {
        setDays([...generatedDays]);
        setPlan({ ...planMeta, days: generatedDays });
        setIsLoading(false);
      }

      for (let index = generatedDays.length; index < totalDays; index++) {
        setProgressDay(index);

        let result;
        try {
          result = await tripOutfitsService.generateTripOutfits(buildTripDayGenerationParams({
            tripId: activeTripId,
            draft,
            dayIndex: index,
            previousDaysSummary: buildPreviousTripDaysSummary(generatedDays),
            usedOuterwear: collectUsedOuterwear(generatedDays),
            usedFootwear: collectUsedFootwear(generatedDays),
            usedAnchorItemIds: collectUsedAnchorItemIds(generatedDays),
          }));
        } catch (err) {
          recordError(err, 'trip_progressive_generation_day_failed');
          setErrorMessage(err instanceof Error ? err.message : 'Generation failed. Please go back and try again.');
          setIsLoading(false);
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
    } catch (err) {
      recordError(err, 'trip_progressive_generation_failed');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong generating your trip. Please go back and try again.');
      setIsLoading(false);
    } finally {
      progressiveRunning.current = false;
    }
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
