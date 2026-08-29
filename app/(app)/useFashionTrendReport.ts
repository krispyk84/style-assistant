import { useRef, useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import { loadWeatherContext } from '@/lib/weather-storage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import type { SeasonalTrendReportEntry } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

const POLL_INTERVAL_MS = 3000;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function hasPendingSketch(trends: SeasonalTrendReportEntry[]) {
  return trends.some((t) => t.sketchStatus === 'pending' || t.sketchStatus === null);
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
  // Bumped on every open()/close() — invalidates any in-flight poll loop from
  // a previous open so it stops touching state once the modal is no longer
  // the one that started it. No attempt cap: generation genuinely can take a
  // while, and the user can always close the modal to stop waiting.
  const generationTokenRef = useRef(0);

  async function open() {
    const token = ++generationTokenRef.current;
    setIsOpen(true);
    setIsLoading(true);
    setIsGenerating(false);
    setError(null);
    setTrends(null);

    const weatherContext = await loadWeatherContext();
    const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
    const region = weatherContext?.countryCode ?? undefined;
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';

    // Opening the report is what actually triggers generation if nothing
    // exists yet — ensure() is idempotent, so this is safe even if a
    // background check already fired one on app launch.
    void seasonalTrendsService.ensure({ fashionGender, hemisphere, region });

    let firstAttempt = true;
    while (generationTokenRef.current === token) {
      const response = await seasonalTrendsService.getReport(fashionGender, hemisphere);
      if (generationTokenRef.current !== token) return; // closed or reopened while this was in flight

      if (response.success && response.data?.available) {
        setTrends(response.data.trends);
        setIsStale(response.data.isStale);
        setIsLoading(false);
        setIsGenerating(false);

        // The list itself is ready — sketches for individual trends may
        // still be generating in the background. Keep this same loop going
        // (without blocking the "isLoading" UI any further) so images pop in
        // progressively as they finish, until none are left pending.
        if (!hasPendingSketch(response.data.trends)) return;
        await wait(POLL_INTERVAL_MS);
        continue;
      }

      if (!response.success) {
        setTrends(null);
        setError(response.error?.message ?? 'Could not load the trend report.');
        setIsLoading(false);
        setIsGenerating(false);
        return;
      }

      // available: false — a generation is (or should be) in flight; keep polling
      // for as long as the modal stays open.
      if (!firstAttempt) setIsGenerating(true);
      firstAttempt = false;
      await wait(POLL_INTERVAL_MS);
    }
  }

  function close() {
    generationTokenRef.current++;
    setIsOpen(false);
  }

  return { isOpen, open, close, isLoading, isGenerating, trends, isStale, error };
}
