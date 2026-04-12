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
      // Prefetch all images into expo-image's cache so carousel transitions are instant
      if (shuffled.length > 0) {
        void Image.prefetch(shuffled);
      }
      setCarouselImages(shuffled);
    }
    void loadImages();
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
  };
}
