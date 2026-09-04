import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { tripDayVariantFlow } from '@/lib/trip-day-variant-flow';
import { closetService } from '@/services/closet';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';

export function useTripDayVariants() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [variants, setVariants] = useState<TripOutfitDay[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  useEffect(() => {
    closetService.getItems().then((res) => {
      if (res.success && res.data) setClosetItems(res.data.items ?? []);
    });

    const request = tripDayVariantFlow.consumePendingRequest();
    if (!request) {
      setErrorMessage('No swap request found — go back and try again.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await tripOutfitsService.generateDayVariants(request);
        if (!cancelled) setVariants(result);
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not generate variants.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function selectVariant(day: TripOutfitDay) {
    tripDayVariantFlow.emit(day);
    router.back();
  }

  return { isLoading, errorMessage, variants, closetItems, selectVariant };
}
