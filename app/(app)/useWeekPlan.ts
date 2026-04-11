import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

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

  // useFocusEffect runs ONLY when this screen gains focus, never when losing it.
  // Previously, useEffect([isFocused]) ran on BOTH focus gain and focus loss, creating
  // two concurrent hydrate() calls with racing isMounted closures that could drop state
  // updates and leave the screen stuck on the loading spinner.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void (async function hydrate() {
        setIsLoadingWeek(true);
        try {
          const [nextItems, savedOutfits, forecast] = await Promise.all([
            loadWeekPlan(),
            loadSavedOutfits(),
            loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
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
          }

          // Persist refresh even if the user has navigated away
          await replaceWeekPlan(refreshedItems);
        } finally {
          if (isMounted) {
            setIsLoadingWeek(false);
          }
        }
      })();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  return { items, setItems, savedOutfitIds, setSavedOutfitIds, forecastByDay, isLoadingWeek };
}
