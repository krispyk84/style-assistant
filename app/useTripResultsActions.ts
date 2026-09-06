import { router } from 'expo-router';
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

import type { OutfitThumbnailItem } from '@/components/cards/OutfitItemThumbnailRow';
import { buildTripDayVariantsHref } from '@/lib/trip-route';
import { tripDayVariantFlow } from '@/lib/trip-day-variant-flow';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { savedTripsService } from '@/services/saved-trips';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';
import { buildSaveTripPayload } from './trip-results-mappers';

type UseTripResultsActionsParams = {
  plan: StoredTripPlan | null;
  days: TripOutfitDay[];
  setDays: Dispatch<SetStateAction<TripOutfitDay[]>>;
  tripId?: string;
  savedTripId?: string;
  startSketchPoll: (dayId: string, jobId: string, tripId: string) => void;
  stopSketchPoll: (dayId: string) => void;
};

export function useTripResultsActions({
  plan,
  days,
  setDays,
  tripId,
  savedTripId,
  startSketchPoll,
  stopSketchPoll,
}: UseTripResultsActionsParams) {
  const [regeneratingDays, setRegeneratingDays] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedDbId, setSavedDbId] = useState<string | null>(savedTripId ?? null);
  const [updatingAccessoryDayId, setUpdatingAccessoryDayId] = useState<string | null>(null);

  // Persists a single day's edit past this screen session. An unsaved trip
  // lives only in local AsyncStorage (tripOutfitsStorage); an already-saved
  // trip has to be re-posted to the backend (upserts on tripId) — without
  // this, every mutation below (love/hate, sketch, variant swap, hat/bag
  // toggle, remove-from-outfit) only ever updated in-memory `days` and
  // reverted to the last-saved version on the next visit.
  const persistDay = useCallback(async (activeTripId: string, updatedDay: TripOutfitDay) => {
    if (savedTripId && plan) {
      const nextDays = days.map((d) => (d.id === updatedDay.id ? updatedDay : d));
      await savedTripsService.save(buildSaveTripPayload(plan, nextDays)).catch(() => {});
    } else {
      await tripOutfitsStorage.updateDay(activeTripId, updatedDay);
    }
  }, [days, plan, savedTripId]);

  const handleGenerateSketch = useCallback(async (day: TripOutfitDay) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan) return;

    const updatedLoading: TripOutfitDay = { ...day, sketchStatus: 'loading' };
    setDays((prev) => prev.map((current) => (current.id === day.id ? updatedLoading : current)));

    try {
      const { jobId } = await tripOutfitsService.startDaySketch({
        destination: plan.destination,
        dayTitle: day.title,
        climateLabel: plan.climateLabel,
        pieces: day.pieces,
        shoes: day.shoes,
        accessories: day.accessories,
      });

      const withJob: TripOutfitDay = { ...updatedLoading, sketchJobId: jobId };
      setDays((prev) => prev.map((current) => (current.id === day.id ? withJob : current)));
      await persistDay(activeTripId, withJob);

      startSketchPoll(day.id, jobId, activeTripId);
    } catch {
      const failed: TripOutfitDay = { ...day, sketchStatus: 'failed' };
      setDays((prev) => prev.map((current) => (current.id === day.id ? failed : current)));
      await persistDay(activeTripId, failed);
    }
  }, [persistDay, plan, setDays, startSketchPoll, tripId]);

  const handleLove = useCallback(async (day: TripOutfitDay) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId) return;
    const newFeedback = day.feedback === 'love' ? null : 'love' as const;
    const updated: TripOutfitDay = { ...day, feedback: newFeedback };
    setDays((prev) => prev.map((current) => (current.id === day.id ? updated : current)));
    await persistDay(activeTripId, updated);
  }, [persistDay, plan?.tripId, setDays, tripId]);

  const handleHate = useCallback(async (day: TripOutfitDay) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan) return;

    stopSketchPoll(day.id);
    setRegeneratingDays((prev) => new Set(prev).add(day.id));

    try {
      const newDay = await tripOutfitsService.regenerateDay({
        tripId: activeTripId,
        dayIndex: day.dayIndex,
        date: day.date,
        dayType: day.dayType,
        formalityTier: day.formalityTier,
        destination: plan.destination,
        country: plan.country,
        climateLabel: plan.climateLabel,
        avgHighC: plan.avgHighC,
        avgLowC: plan.avgLowC,
        activities: plan.activities,
        dressCode: plan.dressCode,
        styleVibe: plan.styleVibe,
        purposes: plan.purposes,
        previousPieces: day.pieces,
        previousShoes: day.shoes,
        isFullCloset: !!day.closetItemIds?.length,
      });

      setDays((prev) => prev.map((current) => (current.id === day.id ? newDay : current)));
      await persistDay(activeTripId, newDay);
    } catch {
      // Regeneration failed: leave the card as-is.
    } finally {
      setRegeneratingDays((prev) => {
        const next = new Set(prev);
        next.delete(day.id);
        return next;
      });
    }
  }, [persistDay, plan, setDays, stopSketchPoll, tripId]);

  // Swap 1-2 items on a fullCloset day: push a request for the dedicated
  // variant-selection screen, then wait for it to hand back the chosen day.
  const handleGenerateVariants = useCallback((day: TripOutfitDay, swapItemIds: string[], swappedItems: OutfitThumbnailItem[]) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan) return;

    const keepItemIds = (day.closetItemIds ?? []).filter((id) => !swapItemIds.includes(id));

    tripDayVariantFlow.setPendingRequest({
      tripId: activeTripId,
      dayIndex: day.dayIndex,
      date: day.date,
      dayType: day.dayType,
      formalityTier: day.formalityTier,
      destination: plan.destination,
      country: plan.country,
      climateLabel: plan.climateLabel,
      avgHighC: plan.avgHighC,
      avgLowC: plan.avgLowC,
      activities: plan.activities,
      dressCode: plan.dressCode,
      styleVibe: plan.styleVibe,
      purposes: plan.purposes,
      keepItemIds,
      swapItemIds,
      swappedItems,
    });

    tripDayVariantFlow.setListener((selectedDay) => {
      stopSketchPoll(day.id);
      const merged: TripOutfitDay = { ...selectedDay, id: day.id, feedback: null };
      setDays((prev) => prev.map((current) => (current.id === day.id ? merged : current)));
      void persistDay(activeTripId, merged);
    });

    router.push(buildTripDayVariantsHref());
  }, [persistDay, plan, setDays, stopSketchPoll, tripId]);

  // Clear any dangling listener if the screen unmounts before a selection is made.
  useEffect(() => () => tripDayVariantFlow.clearListener(), []);

  // Toggle a hat/bag in or out of a fullCloset day: reloads just that day's
  // item list and sketch, leaving every other already-chosen item, plus the
  // title/rationale, untouched. Mirrors handleGenerateSketch's job-then-poll
  // flow for kicking off the fresh sketch once the new item list is known.
  const handleToggleDayAccessory = useCallback(async (day: TripOutfitDay, toggle: { includeHat: boolean; includeBag: boolean }) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan || updatingAccessoryDayId) return;

    setUpdatingAccessoryDayId(day.id);
    try {
      const result = await tripOutfitsService.updateDayAccessories({
        itemIds: day.closetItemIds ?? [],
        dayType: day.dayType,
        formalityTier: day.formalityTier,
        includeHat: toggle.includeHat,
        includeBag: toggle.includeBag,
      });

      stopSketchPoll(day.id);
      const updatedDay: TripOutfitDay = {
        ...day,
        pieces: result.pieces,
        shoes: result.shoes,
        bag: result.bag,
        accessories: result.accessories,
        closetItemIds: result.closetItemIds,
        sketchStatus: 'loading',
        sketchUrl: undefined,
        sketchJobId: undefined,
      };
      setDays((prev) => prev.map((current) => (current.id === day.id ? updatedDay : current)));
      await persistDay(activeTripId, updatedDay);

      const { jobId } = await tripOutfitsService.startDaySketch({
        destination: plan.destination,
        dayTitle: updatedDay.title,
        climateLabel: plan.climateLabel,
        pieces: updatedDay.pieces,
        shoes: updatedDay.shoes,
        accessories: updatedDay.accessories,
      });
      const withJob: TripOutfitDay = { ...updatedDay, sketchJobId: jobId };
      setDays((prev) => prev.map((current) => (current.id === day.id ? withJob : current)));
      await persistDay(activeTripId, withJob);
      startSketchPoll(day.id, jobId, activeTripId);
    } catch {
      // Update failed: leave the card as-is.
    } finally {
      setUpdatingAccessoryDayId(null);
    }
  }, [persistDay, plan, setDays, startSketchPoll, stopSketchPoll, tripId, updatingAccessoryDayId]);

  // Drops exactly one piece from a fullCloset day, keeping the title/
  // rationale and every other item untouched — mirrors handleToggleDayAccessory's
  // recompute-only-what-changed approach, but deliberately does NOT auto-start
  // a new sketch job: the composition just changed, so the old sketch no
  // longer matches it, and the user should explicitly ask for a new one
  // rather than an automatic redraw happening behind them.
  const handleRemoveItemFromDay = useCallback(async (
    day: TripOutfitDay,
    itemId: string,
    accessoryState: { includeHat: boolean; includeBag: boolean },
  ) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan || updatingAccessoryDayId) return;

    setUpdatingAccessoryDayId(day.id);
    try {
      const filteredItemIds = (day.closetItemIds ?? []).filter((id) => id !== itemId);
      const result = await tripOutfitsService.updateDayAccessories({
        itemIds: filteredItemIds,
        dayType: day.dayType,
        formalityTier: day.formalityTier,
        includeHat: accessoryState.includeHat,
        includeBag: accessoryState.includeBag,
      });

      stopSketchPoll(day.id);
      const updatedDay: TripOutfitDay = {
        ...day,
        pieces: result.pieces,
        shoes: result.shoes,
        bag: result.bag,
        accessories: result.accessories,
        closetItemIds: result.closetItemIds,
        framework: result.framework,
        sketchStatus: 'not_started',
        sketchUrl: undefined,
        sketchJobId: undefined,
      };
      setDays((prev) => prev.map((current) => (current.id === day.id ? updatedDay : current)));
      await persistDay(activeTripId, updatedDay);
    } catch {
      // Update failed: leave the card as-is.
    } finally {
      setUpdatingAccessoryDayId(null);
    }
  }, [persistDay, plan, setDays, stopSketchPoll, tripId, updatingAccessoryDayId]);

  const handleSaveTrip = useCallback(async () => {
    if (!plan || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await savedTripsService.save(buildSaveTripPayload(plan, days));
      setSavedDbId(saved.id);
    } catch {
      // User can retry.
    } finally {
      setIsSaving(false);
    }
  }, [days, isSaving, plan]);

  return {
    regeneratingDays,
    isSaving,
    savedDbId,
    updatingAccessoryDayId,
    handleGenerateSketch,
    handleLove,
    handleHate,
    handleGenerateVariants,
    handleSaveTrip,
    handleToggleDayAccessory,
    handleRemoveItemFromDay,
  };
}
