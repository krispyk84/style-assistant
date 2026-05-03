import { useEffect, useMemo, useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import type { TripDraft } from '@/lib/trip-draft-storage';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { TripAnchorContext } from '@/lib/trip-anchor-recommender';
import { recommendTripAnchors } from '@/lib/trip-anchor-recommender';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';

export function useTripAnchorData() {
  const { profile } = useAppSession();
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetLoaded, setClosetLoaded] = useState(false);

  useEffect(() => {
    tripDraftStorage.load().then((loadedDraft) => {
      if (loadedDraft) setDraft(loadedDraft);
      else setDraftError(true);
    }).catch(() => setDraftError(true));
  }, []);

  useEffect(() => {
    closetService
      .getItems()
      .then((res) => {
        if (res.success && res.data) setClosetItems(res.data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setClosetLoaded(true));
  }, []);

  const tripCtx = useMemo<TripAnchorContext | null>(() => {
    if (!draft) return null;
    return {
      numDays: draft.numDays,
      destination: draft.destinationLabel,
      purposes: draft.purposes,
      willSwim: draft.willSwim,
      fancyNights: draft.fancyNights,
      workoutClothes: draft.workoutClothes,
      laundryAccess: draft.laundryAccess,
      shoesCount: draft.shoesCount,
      carryOnOnly: draft.carryOnOnly,
      climateLabel: draft.climateLabel,
      styleVibe: draft.styleVibe,
      gender: profile.gender as 'man' | 'woman' | 'non-binary' | undefined,
      avgHighC: draft.avgHighC,
      avgLowC: draft.avgLowC,
    };
  }, [draft, profile.gender]);

  const recommendation = useMemo(() => (
    tripCtx ? recommendTripAnchors(tripCtx) : null
  ), [tripCtx]);

  return {
    draft,
    draftError,
    closetItems,
    closetLoaded,
    hasClosetItems: closetItems.length > 0,
    tripCtx,
    recommendation,
  };
}
