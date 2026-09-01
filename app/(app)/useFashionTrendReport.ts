import { useEffect, useRef, useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import { loadWeatherContext } from '@/lib/weather-storage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import { seasonalColorsService } from '@/services/seasonal-colors';
import type { SeasonalColorEntry, SeasonalTrendReportEntry, TrendFeedbackValue } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

const POLL_INTERVAL_MS = 3000;
const NEW_REPORT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function hasPendingSketch(items: { sketchStatus: 'pending' | 'ready' | 'failed' | null }[]) {
  return items.some((i) => i.sketchStatus === 'pending' || i.sketchStatus === null);
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
  // Colours load independently of trends — its own loading/generating/error
  // state so one section's slower generation never blocks the other's.
  const [isLoadingColors, setIsLoadingColors] = useState(false);
  const [isGeneratingColors, setIsGeneratingColors] = useState(false);
  const [colors, setColors] = useState<SeasonalColorEntry[] | null>(null);
  const [colorsError, setColorsError] = useState<string | null>(null);
  // Bumped on every open()/close() — invalidates any in-flight poll loop from
  // a previous open so it stops touching state once the modal is no longer
  // the one that started it. No attempt cap: generation genuinely can take a
  // while, and the user can always close the modal to stop waiting.
  const generationTokenRef = useRef(0);

  // Read-only peek at the current report's age — separate from open()/
  // pollTrends, which is what actually triggers generation (via .ensure())
  // and drives the modal's own loading state. This runs once on mount so
  // Home can show a "new" indicator on the entry point without opening it.
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const weatherContext = await loadWeatherContext();
      const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
      const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';
      const response = await seasonalTrendsService.getReport(fashionGender, hemisphere);
      if (!cancelled && response.success && response.data?.available) {
        setGeneratedAt(response.data.generatedAt);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.gender]);
  const isNewReport = generatedAt !== null && Date.now() - new Date(generatedAt).getTime() < NEW_REPORT_WINDOW_MS;

  async function pollTrends(token: number, fashionGender: 'menswear' | 'womenswear', hemisphere: Hemisphere, region: string | undefined) {
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

  async function pollColors(token: number, fashionGender: 'menswear' | 'womenswear', hemisphere: Hemisphere, region: string | undefined) {
    void seasonalColorsService.ensure({ fashionGender, hemisphere, region });

    let firstAttempt = true;
    while (generationTokenRef.current === token) {
      const response = await seasonalColorsService.getReport(fashionGender, hemisphere);
      if (generationTokenRef.current !== token) return;

      if (response.success && response.data?.available) {
        setColors(response.data.colors);
        setIsLoadingColors(false);
        setIsGeneratingColors(false);

        if (!hasPendingSketch(response.data.colors)) return;
        await wait(POLL_INTERVAL_MS);
        continue;
      }

      if (!response.success) {
        setColors(null);
        setColorsError(response.error?.message ?? 'Could not load the colour palette.');
        setIsLoadingColors(false);
        setIsGeneratingColors(false);
        return;
      }

      if (!firstAttempt) setIsGeneratingColors(true);
      firstAttempt = false;
      await wait(POLL_INTERVAL_MS);
    }
  }

  async function open() {
    const token = ++generationTokenRef.current;
    setIsOpen(true);
    setIsLoading(true);
    setIsGenerating(false);
    setError(null);
    setTrends(null);
    setIsLoadingColors(true);
    setIsGeneratingColors(false);
    setColorsError(null);
    setColors(null);

    const weatherContext = await loadWeatherContext();
    const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
    const region = weatherContext?.countryCode ?? undefined;
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';

    // Independent loops — colours finishing (or failing) never blocks trends
    // and vice versa.
    void pollTrends(token, fashionGender, hemisphere, region);
    void pollColors(token, fashionGender, hemisphere, region);
  }

  function close() {
    generationTokenRef.current++;
    setIsOpen(false);
  }

  // Personal, per-user bias only — never affects what other users see for
  // this trend. Optimistic local update so the thumb responds instantly;
  // reverted if the request fails.
  async function setTrendFeedback(trendName: string, feedback: TrendFeedbackValue | null) {
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';
    let previous: TrendFeedbackValue | null = null;
    setTrends((prev) => {
      if (!prev) return prev;
      return prev.map((t) => {
        if (t.name !== trendName) return t;
        previous = t.userFeedback;
        return { ...t, userFeedback: feedback };
      });
    });

    const response = await seasonalTrendsService.setFeedback({ fashionGender, trendName, feedback });
    if (!response.success) {
      setTrends((prev) => prev?.map((t) => (t.name === trendName ? { ...t, userFeedback: previous } : t)) ?? prev);
    }
  }

  // Mirrors setTrendFeedback exactly, operating on the colors array instead.
  async function setColorFeedback(colorName: string, feedback: TrendFeedbackValue | null) {
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';
    let previous: TrendFeedbackValue | null = null;
    setColors((prev) => {
      if (!prev) return prev;
      return prev.map((c) => {
        if (c.name !== colorName) return c;
        previous = c.userFeedback;
        return { ...c, userFeedback: feedback };
      });
    });

    const response = await seasonalColorsService.setFeedback({ fashionGender, colorName, feedback });
    if (!response.success) {
      setColors((prev) => prev?.map((c) => (c.name === colorName ? { ...c, userFeedback: previous } : c)) ?? prev);
    }
  }

  return {
    isOpen, open, close, isLoading, isGenerating, trends, isStale, error, setTrendFeedback,
    isLoadingColors, isGeneratingColors, colors, colorsError, setColorFeedback,
    isNewReport,
  };
}
