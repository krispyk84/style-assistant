import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';
import type { LookTierSlug } from '@/types/look-request';

type UseResultsPollingParams = {
  response: GenerateOutfitsResponse | null;
  // loadingTiers is owned by useResultsData and passed here as a read-only gate.
  // The poll must not start until loadingTiers drains to [] — otherwise a server
  // response containing only already-finished tiers would overwrite the client-merged
  // partial response that holds in-flight tier placeholders.
  loadingTiers: LookTierSlug[];
  regeneratingTiersRef: MutableRefObject<LookTierSlug[]>;
  setResponse: Dispatch<SetStateAction<GenerateOutfitsResponse | null>>;
};

export function useResultsPolling({
  response,
  loadingTiers,
  regeneratingTiersRef,
  setResponse,
}: UseResultsPollingParams) {
  const requestId = response?.requestId;
  // Changes only on a real per-tier sketch-status transition (e.g. pending -> ready),
  // not on every poll tick — setResponse below always produces a fresh response object
  // even when nothing actually changed, so depending on `response` itself would tear
  // down and recreate the interval every 4s.
  const pendingSignature = response?.recommendations.map((item) => `${item.tier}:${item.sketchStatus}`).join(',') ?? '';
  const isPollingRef = useRef(false);

  useEffect(() => {
    // Wait until all tiers are loaded before polling for sketches — otherwise the server
    // response would only contain the tiers already saved (potentially just 1) and would
    // overwrite the client-merged partial response.
    if (loadingTiers.length > 0) return;

    if (!requestId || !response?.recommendations.some((item) => item.sketchStatus === 'pending')) {
      return;
    }

    const interval = setInterval(async () => {
      // Skip this tick if the previous one is still awaiting — a slow response
      // must not overlap with the next scheduled poll.
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const serviceResponse = await outfitsService.getOutfitResult(requestId);

        if (serviceResponse.success && serviceResponse.data) {
          setResponse((current) => {
            if (!current || !serviceResponse.data) return current;
            const protecting = regeneratingTiersRef.current;
            // If no tiers are mid-regeneration, apply the full server response as-is.
            if (protecting.length === 0) return serviceResponse.data;
            // Otherwise preserve the in-flight state for any tier currently being regenerated
            // so stale server data doesn't overwrite a pending regeneration.
            return {
              ...serviceResponse.data,
              recommendations: serviceResponse.data.recommendations.map((newRec) =>
                protecting.includes(newRec.tier)
                  ? (current.recommendations.find((r) => r.tier === newRec.tier) ?? newRec)
                  : newRec,
              ),
            };
          });
        }
      } finally {
        isPollingRef.current = false;
      }
    }, 4000);

    return () => clearInterval(interval);
    // regeneratingTiersRef and setResponse are stable (ref + setState dispatcher) — omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, pendingSignature, loadingTiers.length]);
}
