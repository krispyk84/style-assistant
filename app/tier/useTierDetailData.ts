import { useEffect, useMemo, useState } from 'react';

import { useLocalSearchParams } from 'expo-router';

import { getLookTierDefinition } from '@/lib/look-mock-data';
import { parseLookInput, parseLookRecommendation, type LookRouteParams } from '@/lib/look-route';
import { outfitsService } from '@/services/outfits';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation } from '@/types/look-request';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTierDetailData() {
  const params = useLocalSearchParams<LookRouteParams & { tier: string; requestId?: string }>();
  const routeKey = JSON.stringify(params);

  // Stabilise params to prevent re-renders triggered by useLocalSearchParams reference churn
  const stableParams = useMemo(
    () => JSON.parse(routeKey) as LookRouteParams & { tier: string; requestId?: string },
    [routeKey]
  );

  const matchedTier = stableParams.tier ? getLookTierDefinition(stableParams.tier) : undefined;
  const requestInput = useMemo(() => parseLookInput(stableParams), [stableParams]);
  const initialRecommendation = useMemo(() => parseLookRecommendation(stableParams), [stableParams]);

  const [liveRecommendation, setLiveRecommendation] = useState<LookRecommendation | null>(initialRecommendation);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  // ── Load closet items once on mount ─────────────────────────────────────────
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) {
        setClosetItems(response.data.items);
      }
    });
  }, []);

  // ── Sketch polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    const requestId = stableParams.requestId;
    const tier = stableParams.tier;

    if (!requestId || !tier || liveRecommendation?.sketchStatus !== 'pending') {
      return;
    }

    const interval = setInterval(async () => {
      const serviceResponse = await outfitsService.getOutfitResult(requestId);

      if (!serviceResponse.success || !serviceResponse.data) {
        return;
      }

      const nextRecommendation = serviceResponse.data.recommendations.find((item) => item.tier === tier);
      if (nextRecommendation) {
        setLiveRecommendation(nextRecommendation);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [liveRecommendation?.sketchStatus, stableParams.requestId, stableParams.tier]);

  return { stableParams, requestInput, matchedTier, liveRecommendation, closetItems };
}
