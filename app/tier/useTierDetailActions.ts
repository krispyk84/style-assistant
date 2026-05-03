import { useEffect, useState } from 'react';

import { router } from 'expo-router';

import { useToast } from '@/components/ui/toast-provider';
import {
  loadRecommendationFeedback,
  saveRecommendationFeedback,
} from '@/lib/recommendation-feedback-storage';
import type { CreateLookInput, LookRecommendation } from '@/types/look-request';

// ── Types ──────────────────────────────────────────────────────────────────────

type OutfitFeedback = 'love' | 'hate' | null;

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
  const [outfitFeedback, setOutfitFeedback] = useState<OutfitFeedback>(null);

  const { showToast } = useToast();

  // Load existing outfit-level feedback for this request+tier on mount
  useEffect(() => {
    if (!requestId || !liveRecommendation?.tier) return;
    void loadRecommendationFeedback().then((all) => {
      const existing = all.find(
        (f) =>
          f.requestId === requestId &&
          f.tier === liveRecommendation.tier &&
          (f.thumb === 'love' || f.thumb === 'hate'),
      );
      if (existing) {
        setOutfitFeedback(existing.thumb as OutfitFeedback);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOutfitFeedback(thumb: 'love' | 'hate') {
    if (!requestId || !liveRecommendation) return;
    // Tapping the already-selected state deselects (clears feedback — not persisted as a removal,
    // just resets local state; a new save would overwrite on next selection)
    if (outfitFeedback === thumb) {
      setOutfitFeedback(null);
      return;
    }
    setOutfitFeedback(thumb);
    await saveRecommendationFeedback({
      id: `${requestId}:${liveRecommendation.tier}:outfit`,
      requestId,
      tier: liveRecommendation.tier,
      outfitTitle: liveRecommendation.title,
      thumb,
      regenerated: false,
      createdAt: new Date().toISOString(),
    });
    showToast(thumb === 'love' ? 'Noted — glad you love it.' : 'Noted — we\'ll keep that in mind.');
  }

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

  return {
    secondOpinionVisible,
    setSecondOpinionVisible,
    outfitFeedback,
    handleOutfitFeedback,
    handleCheckPiece,
    handleSelfieCheck,
  };
}
