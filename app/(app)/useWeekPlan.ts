import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { loadClosetWeekPlan, loadSavedClosetOutfits, type ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';
import { loadWeekPlan, replaceWeekPlan } from '@/lib/week-plan-storage';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';
import { outfitsService } from '@/services/outfits';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useWeekPlan() {
  const [items, setItems] = useState<WeekPlannedOutfit[]>([]);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [forecastByDay, setForecastByDay] = useState<Record<string, WeekForecastDay>>({});
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);
  const [closetItems, setClosetItems] = useState<ClosetWeekPlanItem[]>([]);
  const [closetSavedOutfitIds, setClosetSavedOutfitIds] = useState<string[]>([]);
  // Only the genuinely first load shows the full loading state — a refocus
  // with data already on screen refreshes silently in the background so
  // switching back into this tab never flickers back to a loading state.
  const hasLoadedOnceRef = useRef(false);

  // useFocusEffect runs ONLY when this screen gains focus, never when losing it.
  // Previously, useEffect([isFocused]) ran on BOTH focus gain and focus loss, creating
  // two concurrent hydrate() calls with racing isMounted closures that could drop state
  // updates and leave the screen stuck on the loading spinner.
  const hydrate = useCallback(() => {
    let isMounted = true;

    void (async function run() {
      if (!hasLoadedOnceRef.current) setIsLoadingWeek(true);
      try {
        const [nextItems, savedOutfits, forecast, nextClosetItems, savedClosetOutfits] = await Promise.all([
          loadWeekPlan(),
          loadSavedOutfits(),
          loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
          loadClosetWeekPlan(),
          loadSavedClosetOutfits(),
        ]);

        const refreshedItems = await Promise.all(
          nextItems.map(async (item) => {
            const response = await outfitsService.getOutfitResult(item.requestId);

            if (!response.success || !response.data) {
              return item;
            }

            const latestRecommendation = response.data.recommendations.find(
              (recommendation) => recommendation.tier === item.recommendation.tier
            );

            if (!latestRecommendation) {
              return item;
            }

            return {
              ...item,
              input: response.data.input,
              recommendation: latestRecommendation,
            };
          })
        );

        if (isMounted) {
          setItems(refreshedItems);
          setSavedOutfitIds(savedOutfits.map((item) => item.id));
          setForecastByDay(Object.fromEntries(forecast.map((day) => [day.dayKey, day])));
          setClosetItems(nextClosetItems);
          setClosetSavedOutfitIds(savedClosetOutfits.map((item) => item.id));
        }

        // Persist refresh even if the user has navigated away
        await replaceWeekPlan(refreshedItems);
      } finally {
        if (isMounted) {
          setIsLoadingWeek(false);
          hasLoadedOnceRef.current = true;
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(hydrate);

  return {
    items, setItems, savedOutfitIds, setSavedOutfitIds, forecastByDay, isLoadingWeek,
    closetItems, setClosetItems, closetSavedOutfitIds, setClosetSavedOutfitIds,
  };
}
