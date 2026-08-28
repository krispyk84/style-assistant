import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { loadAppSettings } from '@/lib/app-settings-storage';
import { loadWeatherContext } from '@/lib/weather-storage';
import { closetService } from '@/services/closet';
import type { ClosetGeneratedOutfit } from '@/types/api';
import type { LookTierSlug } from '@/types/look-request';

export type GenerateOutfitsStage = 'loading' | 'outfits' | 'variations-loading' | 'variations' | 'error';

export function useGenerateOutfitsResults() {
  const params = useLocalSearchParams<{ formality?: string }>();
  const formality = (params.formality as LookTierSlug | undefined) ?? 'smart-casual';

  const [stage, setStage] = useState<GenerateOutfitsStage>('loading');
  const [outfits, setOutfits] = useState<ClosetGeneratedOutfit[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<ClosetGeneratedOutfit | null>(null);
  const [variations, setVariations] = useState<ClosetGeneratedOutfit[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadOutfits() {
    setStage('loading');
    setError(null);
    const [weatherContext, settings] = await Promise.all([loadWeatherContext(), loadAppSettings()]);
    const response = await closetService.generateOutfits({
      formality,
      weatherContext,
      trendiness: settings.trendiness,
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

  async function selectOutfit(outfit: ClosetGeneratedOutfit) {
    setSelectedOutfit(outfit);
    setStage('variations-loading');
    setError(null);
    const [weatherContext, settings] = await Promise.all([loadWeatherContext(), loadAppSettings()]);
    const response = await closetService.generateOutfitVariations({
      formality,
      weatherContext,
      trendiness: settings.trendiness,
      baseItemIds: outfit.items.map((item) => item.id),
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

  return {
    formality,
    stage,
    outfits,
    selectedOutfit,
    variations,
    error,
    loadOutfits,
    selectOutfit,
    backToOutfits,
  };
}
