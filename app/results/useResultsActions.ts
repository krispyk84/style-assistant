import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';
import { type LookTierSlug } from '@/types/look-request';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { loadRecommendationFeedback, saveRecommendationFeedback } from '@/lib/recommendation-feedback-storage';
import { useToast } from '@/components/ui/toast-provider';
import { trackSaveOutfit, trackAddToWeek } from '@/lib/analytics';

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

    const savedOutfitId = buildSavedOutfitId(response.requestId, tier, tierGenerations[tier] ?? 0);
    if (savedOutfitIds.includes(savedOutfitId)) return;

    setSavingTier(tier);

    try {
      // Deep-copy the recommendation snapshot so later regenerations can't mutate what was saved.
      await saveSavedOutfit(response.input, { ...recommendation }, response.requestId, tierGenerations[tier] ?? 0);
      setSavedOutfitIds((current) => [...current, savedOutfitId]);
      trackSaveOutfit({ tier });
      showToast('Outfit saved to history.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }

    setSavingTier(null);
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!response || !weekPickerTier) return;

    const recommendation = response.recommendations.find((item) => item.tier === weekPickerTier);
    if (!recommendation) return;

    try {
      await assignOutfitToWeekDay(dayKey, dayLabel, response.input, { ...recommendation }, response.requestId);
      trackAddToWeek({ tier: weekPickerTier, day_label: dayLabel });
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }

    setWeekPickerTier(null);
  }

  async function handleOutfitFeedback(tier: LookTierSlug, thumb: 'love' | 'hate') {
    if (!response) return;
    const recommendation = response.recommendations.find((r) => r.tier === tier);
    if (!recommendation) return;
    // Tapping the already-selected state deselects
    if (outfitFeedbackMap[tier] === thumb) {
      setOutfitFeedbackMap((prev) => { const next = { ...prev }; delete next[tier]; return next; });
      return;
    }
    setOutfitFeedbackMap((prev) => ({ ...prev, [tier]: thumb }));
    await saveRecommendationFeedback({
      id: `${response.requestId}:${tier}:outfit`,
      requestId: response.requestId,
      tier,
      outfitTitle: recommendation.title,
      thumb,
      regenerated: false,
      createdAt: new Date().toISOString(),
    });
    showToast(thumb === 'love' ? 'Noted — glad you love it.' : "Noted — we'll keep that in mind.");
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
