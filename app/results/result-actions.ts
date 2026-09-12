// Shared save/assign-to-week/outfit-feedback logic for both results screens
// ([requestId].tsx via useResultsActions.ts, and MultiLookResults.tsx
// directly) — extracted because the two callers' handler bodies were
// byte-for-byte identical except for which identity they resolve a
// recommendation/response from (tier vs requestId). These are plain async
// functions, not a hook: each caller already owns its own state (savedOutfitIds,
// a saving-flag, a feedback map) and supplies it here rather than this module
// owning any state itself — "shared behavior, caller-supplied identity/state",
// not a shared state container.

import { buildSavedOutfitId, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { assignOutfitToWeekDay } from '@/lib/week-plan-storage';
import { saveRecommendationFeedback } from '@/lib/recommendation-feedback-storage';
import { trackSaveOutfit, trackAddToWeek } from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import type { CreateLookInput, LookRecommendation, LookTierSlug } from '@/types/look-request';

type ShowToast = (message: string, tone?: 'error') => void;

export async function performSaveOutfit(params: {
  requestId: string;
  tier: LookTierSlug;
  tierGeneration: number;
  input: CreateLookInput;
  recommendation: LookRecommendation;
  savedOutfitIds: string[];
  setSaving: (value: boolean) => void;
  onSaved: (savedOutfitId: string) => void;
  showToast: ShowToast;
}): Promise<void> {
  const { requestId, tier, tierGeneration, input, recommendation, savedOutfitIds, setSaving, onSaved, showToast } = params;
  const savedOutfitId = buildSavedOutfitId(requestId, tier, tierGeneration);
  if (savedOutfitIds.includes(savedOutfitId)) return;
  setSaving(true);
  try {
    await saveSavedOutfit(input, { ...recommendation }, requestId, tierGeneration);
    onSaved(savedOutfitId);
    trackSaveOutfit({ tier });
    showToast('Outfit saved to history.');
  } catch {
    showToast('Could not save this outfit.', 'error');
  }
  setSaving(false);
}

export async function performAssignToWeek(params: {
  dayKey: string;
  dayLabel: string;
  requestId: string;
  tier: LookTierSlug;
  input: CreateLookInput;
  recommendation: LookRecommendation;
  showToast: ShowToast;
}): Promise<void> {
  const { dayKey, dayLabel, requestId, tier, input, recommendation, showToast } = params;
  try {
    await assignOutfitToWeekDay(dayKey, dayLabel, input, { ...recommendation }, requestId);
    trackAddToWeek({ tier, day_label: dayLabel });
    showToast(`Added to ${dayLabel}.`);
  } catch {
    showToast('Could not add this outfit to your week.', 'error');
  }
}

/**
 * `key` is whatever identity the caller's feedback map is keyed by (tier for
 * the single-response screen, requestId for MultiLookResults) — generic so
 * either caller's own Record<K, 'love'|'hate'> setter is directly assignable
 * without a cast.
 */
export async function performOutfitFeedback<TKey extends string>(params: {
  key: TKey;
  requestId: string;
  tier: LookTierSlug;
  recommendationTitle: string;
  thumb: 'love' | 'hate';
  currentFeedback: 'love' | 'hate' | undefined;
  setFeedbackMap: (updater: (prev: Partial<Record<TKey, 'love' | 'hate'>>) => Partial<Record<TKey, 'love' | 'hate'>>) => void;
  showToast: ShowToast;
}): Promise<void> {
  const { key, requestId, tier, recommendationTitle, thumb, currentFeedback, setFeedbackMap, showToast } = params;

  if (currentFeedback === thumb) {
    setFeedbackMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    return;
  }

  setFeedbackMap((prev) => ({ ...prev, [key]: thumb }));
  try {
    await saveRecommendationFeedback({
      id: `${requestId}:${tier}:outfit`,
      requestId,
      tier,
      outfitTitle: recommendationTitle,
      thumb,
      regenerated: false,
      createdAt: new Date().toISOString(),
    });
    showToast(thumb === 'love' ? 'Noted — glad you love it.' : "Noted — we'll keep that in mind.");
  } catch (error) {
    recordError(error, 'outfit_feedback_save');
    setFeedbackMap((prev) => {
      const next = { ...prev };
      if (currentFeedback) next[key] = currentFeedback;
      else delete next[key];
      return next;
    });
  }
}
