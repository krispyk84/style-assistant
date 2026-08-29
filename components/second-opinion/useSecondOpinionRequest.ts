import { useState } from 'react';

import { trackSecondOpinionRequested } from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import { secondOpinionService } from '@/services/second-opinion';
import type { StylistId } from '@/lib/stylists';
import type { SecondOpinionResponse, SecondOpinionSubject } from '@/types/api';

// ── Hook ───────────────────────────────────────────────────────────────────────

type GetOpinionParams = {
  selectedId: StylistId;
  subject: SecondOpinionSubject;
};

export function useSecondOpinionRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SecondOpinionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGetOpinion({ selectedId, subject }: GetOpinionParams) {
    setIsLoading(true);
    setErrorMessage(null);
    trackSecondOpinionRequested({ stylist_id: selectedId });

    const response = await secondOpinionService.getOpinion({
      stylistId: selectedId,
      ...subject,
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
