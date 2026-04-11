import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAppSession } from '@/hooks/use-app-session';
import { useCurrentWeather } from '@/hooks/use-current-weather';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';

// ── Constants ──────────────────────────────────────────────────────────────────

const CAROUSEL_INTERVAL_MS = 10000;
const FADE_DURATION_MS = 600;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHomeData() {
  const { weather, isLoading: weatherLoading, errorMessage: weatherError } = useCurrentWeather();
  const { profile } = useAppSession();

  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Track focus so the carousel animation is skipped when on another tab
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
      setCarouselImages(shuffled);
    }
    void loadImages();
  }, []);

  useEffect(() => {
    if (carouselImages.length <= 1) return;

    const interval = setInterval(() => {
      // Skip animation work when the home tab is not visible
      if (!isFocusedRef.current) return;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        setCarouselIndex((i) => (i + 1) % carouselImages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }).start();
      });
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [carouselImages, fadeAnim]);

  const hasRealImages = carouselImages.length > 0;
  const currentImageUrl = carouselImages[carouselIndex] ?? null;

  return {
    weather,
    weatherLoading,
    weatherError,
    profile,
    hasRealImages,
    currentImageUrl,
    fadeAnim,
  };
}
