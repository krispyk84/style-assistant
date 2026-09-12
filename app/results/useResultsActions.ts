import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';
import { type LookTierSlug } from '@/types/look-request';
import { buildSavedOutfitId, loadSavedOutfits } from '@/lib/saved-outfits-storage';
import { loadRecommendationFeedback } from '@/lib/recommendation-feedback-storage';
import { useToast } from '@/components/ui/toast-provider';
import { performSaveOutfit, performAssignToWeek, performOutfitFeedback } from './result-actions';

type UseResultsActionsParams = {
  response: GenerateOutfitsResponse | null;
  setResponse: Dispatch<SetStateAction<GenerateOutfitsResponse | null>>;
  tierGenerations: Partial<Record<LookTierSlug, number>>;
  setTierGenerations: Dispatch<SetStateAction<Partial<Record<LookTierSlug, number>>>>;
  setRegeneratingTiers: Dispatch<SetStateAction<LookTierSlug[]>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
};

export function useResultsActions({
  response,
  setResponse,
  tierGenerations,
  setTierGenerations,
  setRegeneratingTiers,
  setErrorMessage,
}: UseResultsActionsParams) {
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingTier, setSavingTier] = useState<LookTierSlug | null>(null);
  const [weekPickerTier, setWeekPickerTier] = useState<LookTierSlug | null>(null);
  const [secondOpinionTier, setSecondOpinionTier] = useState<LookTierSlug | null>(null);
  const [outfitFeedbackMap, setOutfitFeedbackMap] = useState<Partial<Record<LookTierSlug, 'love' | 'hate'>>>({});
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    // Reset immediately so stale state from a previous requestId is never visible.
    setOutfitFeedbackMap({});
    setSavedOutfitIds([]);

    async function loadSavedState() {
      const [savedOutfits, allFeedback] = await Promise.all([
        loadSavedOutfits(),
        loadRecommendationFeedback(),
      ]);
      if (!isMounted) return;
      setSavedOutfitIds(savedOutfits.map((item) => item.id));
      if (response?.requestId) {
        const map: Partial<Record<LookTierSlug, 'love' | 'hate'>> = {};
        for (const f of allFeedback) {
          if (f.requestId === response.requestId && (f.thumb === 'love' || f.thumb === 'hate')) {
            map[f.tier as LookTierSlug] = f.thumb;
          }
        }
        setOutfitFeedbackMap(map);
      }
    }

    void loadSavedState();

    return () => {
      isMounted = false;
    };
  }, [response?.requestId]);

  async function handleRegenerate(tier: LookTierSlug) {
    if (!response) return;

    // Capture the current generation BEFORE incrementing so we can remove its save ID.
    const currentGen = tierGenerations[tier] ?? 0;
    const oldSaveId = buildSavedOutfitId(response.requestId, tier, currentGen);

    setTierGenerations((prev) => ({ ...prev, [tier]: currentGen + 1 }));
    setRegeneratingTiers((current) => (current.includes(tier) ? current : [...current, tier]));
    // Clear feedback for this tier — the regenerated outfit is a new entity.
    setOutfitFeedbackMap((prev) => { const next = { ...prev }; delete next[tier]; return next; });
    setErrorMessage(null);
    setResponse((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.map((item) =>
              item.tier === tier
                ? {
                    ...item,
                    sketchStatus: 'pending',
                    sketchImageUrl: null,
                  }
                : item,
            ),
          }
        : current,
    );

    const serviceResponse = await outfitsService.regenerateTier(response.requestId, tier);

    if (!serviceResponse.success || !serviceResponse.data) {
      setErrorMessage(serviceResponse.error?.message ?? 'Failed to regenerate this tier.');
    } else {
      const latestResponse = await outfitsService.getOutfitResult(response.requestId);
      setResponse(latestResponse.success && latestResponse.data ? latestResponse.data : serviceResponse.data);
      // Remove the old generation's save marker — the regenerated outfit is a new entity.
      setSavedOutfitIds((current) => current.filter((id) => id !== oldSaveId));
    }

    setRegeneratingTiers((current) => current.filter((item) => item !== tier));
  }

  async function handleSave(tier: LookTierSlug) {
    if (!response) return;
    const recommendation = response.recommendations.find((item) => item.tier === tier);
    if (!recommendation) return;
    await performSaveOutfit({
      requestId: response.requestId,
      tier,
      tierGeneration: tierGenerations[tier] ?? 0,
      input: response.input,
      recommendation,
      savedOutfitIds,
      setSaving: (isSaving) => setSavingTier(isSaving ? tier : null),
      onSaved: (savedOutfitId) => setSavedOutfitIds((current) => [...current, savedOutfitId]),
      showToast,
    });
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!response || !weekPickerTier) return;
    const recommendation = response.recommendations.find((item) => item.tier === weekPickerTier);
    if (!recommendation) return;
    await performAssignToWeek({
      dayKey,
      dayLabel,
      requestId: response.requestId,
      tier: weekPickerTier,
      input: response.input,
      recommendation,
      showToast,
    });
    setWeekPickerTier(null);
  }

  async function handleOutfitFeedback(tier: LookTierSlug, thumb: 'love' | 'hate') {
    if (!response) return;
    const recommendation = response.recommendations.find((r) => r.tier === tier);
    if (!recommendation) return;
    await performOutfitFeedback({
      key: tier,
      requestId: response.requestId,
      tier,
      recommendationTitle: recommendation.title,
      thumb,
      currentFeedback: outfitFeedbackMap[tier],
      setFeedbackMap: setOutfitFeedbackMap,
      showToast,
    });
  }

  return {
    savedOutfitIds,
    savingTier,
    weekPickerTier,
    setWeekPickerTier,
    secondOpinionTier,
    setSecondOpinionTier,
    outfitFeedbackMap,
    handleRegenerate,
    handleSave,
    handleAssignToWeek,
    handleOutfitFeedback,
  };
}
