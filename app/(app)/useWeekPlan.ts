import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { loadClosetWeekPlan, loadSavedClosetOutfits, type ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';
import { loadWeekPlan, replaceWeekPlan } from '@/lib/week-plan-storage';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';
import { fetchWeekPlanFromSupabase } from '@/lib/supabase-data';
import { withTimeout } from '@/lib/with-timeout';
import { outfitsService } from '@/services/outfits';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

const CLOUD_FALLBACK_TIMEOUT_MS = 10000;

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
        let [nextItems, savedOutfits, forecast, nextClosetItems, savedClosetOutfits] = await Promise.all([
          loadWeekPlan(),
          loadSavedOutfits(),
          loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
          loadClosetWeekPlan(),
          loadSavedClosetOutfits(),
        ]);

        // Local storage is only ever populated by the one-shot sync that
        // runs on SIGNED_IN (lib/user-data-sync.ts) — if that attempt hit a
        // transient network hiccup, local storage stays empty for the rest
        // of the session with no other retry. Treat an empty local result
        // as possibly stale rather than authoritative: fall back to asking
        // the cloud directly, and self-heal local storage if it has data.
        if (nextItems.length === 0) {
          try {
            const cloudItems = await withTimeout(fetchWeekPlanFromSupabase(), CLOUD_FALLBACK_TIMEOUT_MS, 'week-plan cloud fallback');
            if (cloudItems.length > 0) {
              nextItems = await replaceWeekPlan(cloudItems);
            }
          } catch {
            // Cloud fallback failed too — fall through with the empty local result.
          }
        }

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
