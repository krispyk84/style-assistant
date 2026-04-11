import { useState } from 'react';

import { trackSecondOpinionRequested } from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import { secondOpinionService } from '@/services/second-opinion';
import type { StylistId } from '@/lib/stylists';
import type { LookRecommendation } from '@/types/look-request';
import type { SecondOpinionResponse } from '@/types/api';

// ── Hook ───────────────────────────────────────────────────────────────────────

type GetOpinionParams = {
  selectedId: StylistId;
  recommendation: LookRecommendation;
};

export function useSecondOpinionRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SecondOpinionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGetOpinion({ selectedId, recommendation }: GetOpinionParams) {
    setIsLoading(true);
    setErrorMessage(null);
    trackSecondOpinionRequested({ stylist_id: selectedId });

    const response = await secondOpinionService.getOpinion({
      stylistId: selectedId,
      outfitTitle: recommendation.title,
      tier: recommendation.tier,
      anchorItem: recommendation.anchorItem,
      keyPieces: recommendation.keyPieces.map((p) => (typeof p === 'string' ? p : p.display_name)),
      shoes: recommendation.shoes.map((p) => (typeof p === 'string' ? p : p.display_name)),
      accessories: recommendation.accessories.map((p) => (typeof p === 'string' ? p : p.display_name)),
      fitNotes: recommendation.fitNotes,
      whyItWorks: recommendation.whyItWorks,
      stylingDirection: recommendation.stylingDirection,
    });

    setIsLoading(false);

    if (!response.success || !response.data) {
      setErrorMessage(response.error?.message ?? 'Could not get a second opinion. Please try again.');
      recordError(
        new Error(response.error?.message ?? 'Second opinion request failed'),
        'second_opinion_request'
      );
      return;
    }

    setResult(response.data);
  }

  function clearResult() {
    setResult(null);
    setErrorMessage(null);
    setIsLoading(false);
  }

  return { isLoading, result, errorMessage, handleGetOpinion, clearResult };
}
