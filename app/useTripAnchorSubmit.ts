import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

import type { TripDraft } from '@/lib/trip-draft-storage';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import { buildTripResultsHref, createTripId } from '@/lib/trip-route';
import { saveTripPlanAnchors, saveTripPlanDraft } from '@/services/trip-plans';
import type { TripAnchorInput } from '@/services/trip-outfits';
import type { AnchorMode, SelectedAnchor } from './trip-anchors-types';

type UseTripAnchorSubmitParams = {
  draft: TripDraft | null;
  mode: AnchorMode;
  canContinue: boolean;
  activeAnchors: SelectedAnchor[];
};

export function useTripAnchorSubmit({
  draft,
  mode,
  canContinue,
  activeAnchors,
}: UseTripAnchorSubmitParams) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const planIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    saveTripPlanDraft({
      destination: draft.destinationLabel,
      country: draft.country,
      departureDate: draft.departureDate,
      returnDate: draft.returnDate,
      numDays: draft.numDays,
      travelParty: draft.travelParty,
      purposes: draft.purposes,
      climateLabel: draft.climateLabel,
      styleVibe: draft.styleVibe,
      willSwim: draft.willSwim,
      fancyNights: draft.fancyNights,
      workoutClothes: draft.workoutClothes,
      laundryAccess: draft.laundryAccess,
      shoesCount: draft.shoesCount,
      carryOnOnly: draft.carryOnOnly,
      activities: draft.activities,
      dressCode: draft.dressCode,
      specialNeeds: draft.specialNeeds,
      anchorMode: mode,
    }).then((id) => { planIdRef.current = id; });
  }, [draft, mode]);

  const handleContinue = useCallback(async () => {
    if (!draft || !canContinue) return;
    setIsGenerating(true);
    setGenerateError(null);

    const anchorInputs: TripAnchorInput[] = activeAnchors.map((anchor) => ({
      slotId: anchor.slotId,
      label: anchor.label,
      category: anchor.category,
      source: anchor.source as TripAnchorInput['source'],
      closetItemId: anchor.closetItemId,
      uploadedImageId: anchor.uploadedImageId,
      imageUrl: anchor.imageUrl,
      rationale: anchor.rationale,
    }));

    const tripId = createTripId();

    try {
      if (planIdRef.current) {
        void saveTripPlanAnchors(planIdRef.current, mode, anchorInputs);
      }

      await tripDraftStorage.save({
        ...draft,
        pendingAnchors: anchorInputs.length > 0 ? anchorInputs : undefined,
        pendingAnchorMode: mode,
      });

      router.push(buildTripResultsHref({
        tripId,
        destination: draft.destinationLabel,
        isProgressiveGeneration: true,
      }));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [activeAnchors, canContinue, draft, mode]);

  return {
    isGenerating,
    generateError,
    handleContinue,
  };
}
