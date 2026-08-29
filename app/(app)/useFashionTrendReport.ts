import { useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import { loadWeatherContext } from '@/lib/weather-storage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import type { SeasonalTrendReportEntry } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

// Generation is a structured Gemini call for 30 trends across three
// formality tiers — give it a real window to finish rather than checking
// once and giving up. Bounded so a stuck request can't leave the modal
// spinning forever.
const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 3000;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useFashionTrendReport() {
  const { profile } = useAppSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // True once the first check comes back empty and we're actively waiting on
  // a fresh Gemini generation — lets the modal show "generating" copy instead
  // of a generic spinner.
  const [isGenerating, setIsGenerating] = useState(false);
  const [trends, setTrends] = useState<SeasonalTrendReportEntry[] | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setIsOpen(true);
    setIsLoading(true);
    setIsGenerating(false);
    setError(null);

    const weatherContext = await loadWeatherContext();
    const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
    const region = weatherContext?.countryCode ?? undefined;
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';

    // Opening the report is what actually triggers generation if nothing
    // exists yet — ensure() is idempotent, so this is safe even if a
    // background check already fired one on app launch.
    void seasonalTrendsService.ensure({ fashionGender, hemisphere, region });

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      const response = await seasonalTrendsService.getReport(fashionGender, hemisphere);

      if (response.success && response.data?.available) {
        setTrends(response.data.trends);
        setIsStale(response.data.isStale);
        setIsLoading(false);
        setIsGenerating(false);
        return;
      }

      if (!response.success) {
        setTrends(null);
        setError(response.error?.message ?? 'Could not load the trend report.');
        setIsLoading(false);
        setIsGenerating(false);
        return;
      }

      // available: false — a generation is (or should be) in flight; keep polling.
      setIsGenerating(true);
      if (attempt < POLL_ATTEMPTS - 1) await wait(POLL_INTERVAL_MS);
    }

    setTrends(null);
    setError('This season\'s trend report is taking longer than expected to generate — please try again in a moment.');
    setIsLoading(false);
    setIsGenerating(false);
  }

  function close() {
    setIsOpen(false);
  }

  return { isOpen, open, close, isLoading, isGenerating, trends, isStale, error };
}
