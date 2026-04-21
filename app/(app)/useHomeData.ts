import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { useAppSession } from '@/hooks/use-app-session';
import { useCurrentWeather } from '@/hooks/use-current-weather';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';

// ── Constants ──────────────────────────────────────────────────────────────────

const CAROUSEL_INTERVAL_MS = 10000;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHomeData() {
  const { weather, isLoading: weatherLoading, errorMessage: weatherError } = useCurrentWeather();
  const { profile } = useAppSession();

  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isResolved, setIsResolved] = useState(false);
  // Track focus so the carousel is skipped when on another tab
  const isFocusedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    async function loadImages() {
      const saved = await loadSavedOutfits();
      const urls = saved
        .map((s) => s.recommendation.sketchImageUrl)
        .filter((url): url is string => Boolean(url));
      // Shuffle so a different outfit leads each session
      const shuffled = [...urls].sort(() => Math.random() - 0.5);

      if (shuffled.length > 0) {
        // Await the first image (with a 1.5 s cap) so the hero card opens with
        // the real image already in cache — no default → carousel flash.
        await Promise.race([
          Image.prefetch(shuffled[0]!),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
        // Prefetch the rest in the background
        if (shuffled.length > 1) void Image.prefetch(shuffled.slice(1));
      }

      setCarouselImages(shuffled);
      setIsResolved(true);
    }
    void loadImages().catch(() => setIsResolved(true));
  }, []);

  useEffect(() => {
    if (carouselImages.length <= 1) return;

    const interval = setInterval(() => {
      if (!isFocusedRef.current) return;
      setCarouselIndex((i) => (i + 1) % carouselImages.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [carouselImages]);

  const hasRealImages = carouselImages.length > 0;
  const currentImageUrl = carouselImages[carouselIndex] ?? null;

  return {
    weather,
    weatherLoading,
    weatherError,
    profile,
    hasRealImages,
    currentImageUrl,
    isResolved,
  };
}
