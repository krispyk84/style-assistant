import { useEffect, type MutableRefObject } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
  useEffect(() => {
    // Wait until all tiers are loaded before polling for sketches — otherwise the server
    // response would only contain the tiers already saved (potentially just 1) and would
    // overwrite the client-merged partial response.
    if (loadingTiers.length > 0) return;

    if (!response?.requestId || !response.recommendations.some((item) => item.sketchStatus === 'pending')) {
      return;
    }

    const interval = setInterval(async () => {
      const serviceResponse = await outfitsService.getOutfitResult(response.requestId);

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
    }, 4000);

    return () => clearInterval(interval);
    // regeneratingTiersRef and setResponse are stable (ref + setState dispatcher) — omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, loadingTiers.length]);
}
