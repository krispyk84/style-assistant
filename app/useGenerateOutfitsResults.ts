import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useToast } from '@/components/ui/toast-provider';
import { loadAppSettings } from '@/lib/app-settings-storage';
import { assignClosetOutfitToWeekDay, loadSavedClosetOutfits, saveClosetOutfitToFavourites } from '@/lib/closet-outfit-storage';
import { loadWeatherContext } from '@/lib/weather-storage';
import { closetService } from '@/services/closet';
import type { ClosetGeneratedOutfit } from '@/types/api';
import type { LookTierSlug } from '@/types/look-request';

export type GenerateOutfitsStage = 'loading' | 'outfits' | 'variations-loading' | 'variations' | 'error';

export function useGenerateOutfitsResults() {
  const params = useLocalSearchParams<{ formality?: string; additionalDetails?: string }>();
  const formality = (params.formality as LookTierSlug | undefined) ?? 'smart-casual';
  const additionalDetails = params.additionalDetails;

  const [stage, setStage] = useState<GenerateOutfitsStage>('loading');
  const [outfits, setOutfits] = useState<ClosetGeneratedOutfit[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<ClosetGeneratedOutfit | null>(null);
  const [variations, setVariations] = useState<ClosetGeneratedOutfit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingOutfitId, setSavingOutfitId] = useState<string | null>(null);
  const [weekPickerOutfit, setWeekPickerOutfit] = useState<ClosetGeneratedOutfit | null>(null);
  const [secondOpinionOutfit, setSecondOpinionOutfit] = useState<ClosetGeneratedOutfit | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    void loadSavedClosetOutfits().then((saved) => setSavedOutfitIds(saved.map((item) => item.id)));
  }, []);

  async function loadOutfits() {
    setStage('loading');
    setError(null);
    const [weatherContext, settings] = await Promise.all([loadWeatherContext(), loadAppSettings()]);
    const response = await closetService.generateOutfits({
      formality,
      weatherContext,
      trendiness: settings.trendiness,
      hemisphere: weatherContext?.hemisphere ?? undefined,
      region: weatherContext?.countryCode ?? undefined,
      additionalDetails,
    });
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not generate outfits. Please try again.');
      setStage('error');
      return;
    }
    setOutfits(response.data.outfits);
    setStage('outfits');
  }

  useEffect(() => {
    void loadOutfits();
    // Initial load only — formality is fixed for the lifetime of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectOutfit(outfit: ClosetGeneratedOutfit, swapItemIds: string[]) {
    setSelectedOutfit(outfit);
    setStage('variations-loading');
    setError(null);
    const [weatherContext, settings] = await Promise.all([loadWeatherContext(), loadAppSettings()]);
    const response = await closetService.generateOutfitVariations({
      formality,
      weatherContext,
      trendiness: settings.trendiness,
      hemisphere: weatherContext?.hemisphere ?? undefined,
      region: weatherContext?.countryCode ?? undefined,
      additionalDetails,
      baseItemIds: outfit.items.map((item) => item.id),
      swapItemIds,
    });
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not generate variations. Please try again.');
      setStage('outfits');
      return;
    }
    setVariations(response.data.outfits);
    setStage('variations');
  }

  function backToOutfits() {
    setSelectedOutfit(null);
    setVariations([]);
    setError(null);
    setStage('outfits');
  }

  // Poll pending outfit sketch jobs (both base outfits and variations can have
  // in-flight sketches at once) — mirrors the sketch-status polling used for
  // tier/trip/closet-item sketches elsewhere in the app.
  useEffect(() => {
    const pendingIds = [...outfits, ...variations]
      .filter((outfit) => outfit.sketchStatus === 'pending')
      .map((outfit) => outfit.sketchJobId);

    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      const results = await Promise.all(
        pendingIds.map(async (jobId) => {
          const response = await closetService.getItemSketch(jobId);
          return response.success && response.data ? { jobId, ...response.data } : null;
        }),
      );
      const resultsByJobId = new Map(results.filter(Boolean).map((r) => [r!.jobId, r!]));
      if (resultsByJobId.size === 0) return;

      const applyUpdates = (list: ClosetGeneratedOutfit[]) =>
        list.map((outfit) => {
          const update = resultsByJobId.get(outfit.sketchJobId);
          if (!update || update.sketchStatus === 'pending') return outfit;
          return { ...outfit, sketchStatus: update.sketchStatus, sketchImageUrl: update.sketchImageUrl };
        });

      setOutfits(applyUpdates);
      setVariations(applyUpdates);
    }, 4000);

    return () => clearInterval(interval);
  }, [outfits, variations]);

  async function handleSaveOutfit(outfit: ClosetGeneratedOutfit) {
    if (savedOutfitIds.includes(outfit.id) || savingOutfitId) return;
    setSavingOutfitId(outfit.id);
    try {
      await saveClosetOutfitToFavourites(formality, outfit);
      setSavedOutfitIds((current) => [...current, outfit.id]);
      showToast('Outfit saved to favourites.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }
    setSavingOutfitId(null);
  }

  async function handleFeedback(outfit: ClosetGeneratedOutfit, value: 'love' | 'hate') {
    // Tapping the already-selected state clears it, matching the same
    // thumbs-up/down pattern used for tier outfit feedback elsewhere.
    const nextValue = outfit.feedback === value ? null : value;

    const applyUpdate = (list: ClosetGeneratedOutfit[]) =>
      list.map((item) => (item.feedbackId === outfit.feedbackId ? { ...item, feedback: nextValue } : item));
    setOutfits(applyUpdate);
    setVariations(applyUpdate);

    const response = await closetService.setOutfitFeedback({ feedbackId: outfit.feedbackId, feedback: nextValue });
    if (!response.success) {
      // Revert on failure.
      const revert = (list: ClosetGeneratedOutfit[]) =>
        list.map((item) => (item.feedbackId === outfit.feedbackId ? { ...item, feedback: outfit.feedback } : item));
      setOutfits(revert);
      setVariations(revert);
      showToast('Could not save your feedback.', 'error');
    }
  }

  async function handleAssignToWeek(dayKey: string, dayLabel: string) {
    if (!weekPickerOutfit) return;
    try {
      await assignClosetOutfitToWeekDay(dayKey, dayLabel, formality, weekPickerOutfit);
      showToast(`Added to ${dayLabel}.`);
    } catch {
      showToast('Could not add this outfit to your week.', 'error');
    }
    setWeekPickerOutfit(null);
  }

  return {
    formality,
    stage,
    outfits,
    selectedOutfit,
    variations,
    error,
    savedOutfitIds,
    savingOutfitId,
    weekPickerOutfit,
    setWeekPickerOutfit,
    secondOpinionOutfit,
    setSecondOpinionOutfit,
    loadOutfits,
    selectOutfit,
    backToOutfits,
    handleSaveOutfit,
    handleAssignToWeek,
    handleFeedback,
  };
}
