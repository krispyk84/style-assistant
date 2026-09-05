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
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, withJob);

      startSketchPoll(day.id, jobId, activeTripId);
    } catch {
      const failed: TripOutfitDay = { ...day, sketchStatus: 'failed' };
      setDays((prev) => prev.map((current) => (current.id === day.id ? failed : current)));
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, failed);
    }
  }, [plan, savedTripId, setDays, startSketchPoll, tripId]);

  const handleLove = useCallback(async (day: TripOutfitDay) => {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId) return;
    const newFeedback = day.feedback === 'love' ? null : 'love' as const;
    const updated: TripOutfitDay = { ...day, feedback: newFeedback };
    setDays((prev) => prev.map((current) => (current.id === day.id ? updated : current)));
    if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, updated);
  }, [plan?.tripId, savedTripId, setDays, tripId]);

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
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, newDay);
    } catch {
      // Regeneration failed: leave the card as-is.
    } finally {
      setRegeneratingDays((prev) => {
        const next = new Set(prev);
        next.delete(day.id);
        return next;
      });
    }
  }, [plan, savedTripId, setDays, stopSketchPoll, tripId]);

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
      if (!savedTripId) void tripOutfitsStorage.updateDay(activeTripId, merged);
    });

    router.push(buildTripDayVariantsHref());
  }, [plan, savedTripId, setDays, stopSketchPoll, tripId]);

  // Clear any dangling listener if the screen unmounts before a selection is made.
  useEffect(() => () => tripDayVariantFlow.clearListener(), []);

  const handleSaveTrip = useCallback(async () => {
    if (!plan || isSaving) return;
    setIsSaving(true);
    try {
      const daysToSave = days.map((day) =>
        day.sketchStatus === 'loading' ? { ...day, sketchStatus: 'not_started' as const } : day,
      );
      const saved = await savedTripsService.save({
        tripId: plan.tripId,
        destination: plan.destination,
        country: plan.country,
        departureDate: plan.departureDate ?? '',
        returnDate: plan.returnDate ?? '',
        travelParty: plan.travelParty ?? 'Solo',
        climateLabel: plan.climateLabel,
        styleVibe: plan.styleVibe,
        purposes: plan.purposes,
        activities: plan.activities,
        dressCode: plan.dressCode,
        days: daysToSave,
      });
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
    handleGenerateSketch,
    handleLove,
    handleHate,
    handleGenerateVariants,
    handleSaveTrip,
  };
}
