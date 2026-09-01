import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { useAppSession } from '@/hooks/use-app-session';
import { useCurrentWeather } from '@/hooks/use-current-weather';
import { evaluateClosetReadiness, type ClosetReadiness } from '@/lib/closet-readiness';
import { homeReadiness } from '@/lib/home-readiness';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';
import {
  buildSavedOutfitPreview,
  getSavedPreviewImageUrls,
  sortSavedStylePreviews,
  type SavedStylePreview,
} from '@/lib/saved-style-preview';
import { closetService } from '@/services/closet';

// ── Constants ──────────────────────────────────────────────────────────────────

const CAROUSEL_INTERVAL_MS = 10000;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useHomeData() {
  const { weather, isLoading: weatherLoading, errorMessage: weatherError } = useCurrentWeather();
  const { profile } = useAppSession();

  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [savedPreviews, setSavedPreviews] = useState<SavedStylePreview[]>([]);
  const [isResolved, setIsResolved] = useState(false);
  const [closetReadiness, setClosetReadiness] = useState<ClosetReadiness | null>(null);
  const [closetCarouselImages, setClosetCarouselImages] = useState<string[]>([]);
  const [isClosetCarouselResolved, setIsClosetCarouselResolved] = useState(false);
  // Single shared tick drives both carousels so the hero card and the closet
  // card change on the exact same beat, rather than each running its own
  // interval started whenever ITS OWN image list happened to resolve.
  const [carouselTick, setCarouselTick] = useState(0);
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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      void closetService.getItems().then(async (response) => {
        if (!isMounted) return;
        if (!response.success || !response.data) return;

        setClosetReadiness(evaluateClosetReadiness(response.data.items));

        const urls = response.data.items
          .map((item) => item.sketchImageUrl ?? item.uploadedImageUrl)
          .filter((url): url is string => Boolean(url));
        const shuffled = [...urls].sort(() => Math.random() - 0.5);

        if (shuffled.length > 0) {
          await Promise.race([
            Image.prefetch(shuffled[0]!),
            new Promise<void>((resolve) => setTimeout(resolve, 1500)),
          ]);
          if (shuffled.length > 1) void Image.prefetch(shuffled.slice(1));
        }

        if (!isMounted) return;
        setClosetCarouselImages(shuffled);
        setIsClosetCarouselResolved(true);
      });
      return () => {
        isMounted = false;
      };
    }, []),
  );

  useEffect(() => {
    async function loadImages() {
      const saved = await loadSavedOutfits();
      const previews = sortSavedStylePreviews(saved.map(buildSavedOutfitPreview));
      const urls = getSavedPreviewImageUrls(previews);
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

      setSavedPreviews(previews);
      setCarouselImages(shuffled);
      setIsResolved(true);
    }
    void loadImages().catch(() => setIsResolved(true));
  }, []);

  // One interval, started once, ticking for the lifetime of the screen —
  // each carousel just indexes into its own (possibly differently-sized)
  // image list with `tick % length`, so both stay in lockstep regardless of
  // which list resolved first or how long either one is.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFocusedRef.current) return;
      setCarouselTick((t) => t + 1);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const hasRealImages = carouselImages.length > 0;
  const currentImageUrl = carouselImages.length ? carouselImages[carouselTick % carouselImages.length]! : null;
  const closetCurrentImageUrl = closetCarouselImages.length
    ? closetCarouselImages[carouselTick % closetCarouselImages.length]!
    : null;

  // Publishes to the root layout's splash overlay (lib/home-readiness.ts) —
  // once every piece of Home's initial content has settled (hero carousel,
  // closet carousel, weather resolved or failed), the splash can safely hide
  // without Home visibly popping pieces into place underneath it.
  useEffect(() => {
    if (isResolved && isClosetCarouselResolved && !weatherLoading) {
      homeReadiness.setReady(true);
    }
  }, [isResolved, isClosetCarouselResolved, weatherLoading]);

  return {
    weather,
    weatherLoading,
    weatherError,
    profile,
    hasRealImages,
    currentImageUrl,
    savedPreviews,
    isResolved,
    closetReadiness,
    closetCurrentImageUrl,
    isClosetCarouselResolved,
  };
}
