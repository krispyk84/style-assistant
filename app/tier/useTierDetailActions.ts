import { useState } from 'react';

import { router } from 'expo-router';

import type { CreateLookInput } from '@/types/look-request';
import type { LookRecommendation } from '@/types/look-request';

// ── Types ──────────────────────────────────────────────────────────────────────

type UseTierDetailActionsParams = {
  requestId?: string;
  /** May be null before route params are parsed; navigation handlers are no-ops when null. */
  liveRecommendation: LookRecommendation | null;
  requestInput: CreateLookInput | null;
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTierDetailActions({
  requestId,
  liveRecommendation,
  requestInput,
}: UseTierDetailActionsParams) {
  const [secondOpinionVisible, setSecondOpinionVisible] = useState(false);

  function handleCheckPiece(pieceName: string) {
    if (!liveRecommendation) return;
    router.push({
      pathname: '/check-piece',
      params: {
        requestId,
        tier: liveRecommendation.tier,
        outfitTitle: liveRecommendation.title,
        anchorItemDescription: requestInput?.anchorItemDescription,
        pieceName,
      },
    });
  }

  function handleSelfieCheck() {
    if (!liveRecommendation) return;
    router.push({
      pathname: '/selfie-review',
      params: {
        requestId,
        tier: liveRecommendation.tier,
        outfitTitle: liveRecommendation.title,
        anchorItemDescription: requestInput?.anchorItemDescription,
        sketchImageUrl: liveRecommendation.sketchImageUrl ?? '',
      },
    });
  }

  return { secondOpinionVisible, setSecondOpinionVisible, handleCheckPiece, handleSelfieCheck };
}
