import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { logAuthEvent } from '@/lib/auth-event-log';
import { loadClosetWeekPlan, loadSavedClosetOutfits, type ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';
import { loadWeekPlan, replaceWeekPlan } from '@/lib/week-plan-storage';
import { reconcileWeekPlan } from '@/lib/week-plan-reconciliation';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';
import { withTimeout } from '@/lib/with-timeout';
import { outfitsService } from '@/services/outfits';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

const CLOUD_FALLBACK_TIMEOUT_MS = 10000;
const OUTFIT_REFRESH_TIMEOUT_MS = 8000;

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

        // Local storage is only ever populated by the HYDRATED/SIGNED_IN
        // lifecycle reconciliation trigger (contexts/useAuthSideEffects.ts) —
        // if that hit a transient network hiccup, local storage stays empty
        // for the rest of the session with no other retry. Treat an empty
        // local result as possibly stale rather than authoritative and
        // self-heal — but, since Phase 3A2, through reconcileWeekPlan()
        // itself rather than a blind fetchWeekPlanFromSupabase +
        // replaceWeekPlan pull. That old fallback bypassed the decision
        // engine and sync metadata entirely (Phase 2A's identified source of
        // metadata/domain drift) — reconcileWeekPlan reads real server state
        // per day and adopts it through the same Case A/L path every other
        // trigger uses, so an adopted day gets correct lastSeenVersion
        // bookkeeping instead of silently-absent metadata.
        if (nextItems.length === 0) {
          void logAuthEvent('week-load: local empty, trying cloud fallback', null);
          try {
            await withTimeout(reconcileWeekPlan(), CLOUD_FALLBACK_TIMEOUT_MS, 'week-plan cloud fallback');
            nextItems = await loadWeekPlan();
            void logAuthEvent(`week-load: cloud fallback reconciled, ${nextItems.length} local afterward`, null);
          } catch (error) {
            void logAuthEvent(`week-load: cloud fallback ERROR — ${error instanceof Error ? error.message : String(error)}`, null);
          }
        }

        // Show what's already known immediately — the per-item network refresh
        // below (each outfit's latest sketch/recommendation) is a background
        // nice-to-have, not something worth blocking the screen on. Previously
        // isLoadingWeek only cleared in a `finally` AFTER that refresh finished,
        // so a single slow/stalled outfit request (no timeout on the fetch
        // itself) could leave the screen stuck on "Loading your week..."
        // indefinitely. Mirrors the same fix already applied in useFavouritesData.
        if (isMounted) {
          setItems(nextItems);
          setSavedOutfitIds(savedOutfits.map((item) => item.id));
          setForecastByDay(Object.fromEntries(forecast.map((day) => [day.dayKey, day])));
          setClosetItems(nextClosetItems);
          setClosetSavedOutfitIds(savedClosetOutfits.map((item) => item.id));
          setIsLoadingWeek(false);
          hasLoadedOnceRef.current = true;
        }

        const refreshedItems = await Promise.all(
          nextItems.map(async (item) => {
            try {
              const response = await withTimeout(
                outfitsService.getOutfitResult(item.requestId),
                OUTFIT_REFRESH_TIMEOUT_MS,
                `week-plan outfit refresh (${item.requestId})`,
              );

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
            } catch {
              return item;
            }
          })
        );

        if (isMounted) {
          setItems(refreshedItems);
        }

        // Persist refresh even if the user has navigated away
        await replaceWeekPlan(refreshedItems);
      } catch (error) {
        if (isMounted) {
          setIsLoadingWeek(false);
          hasLoadedOnceRef.current = true;
        }
        void logAuthEvent(`week-load ERROR — ${error instanceof Error ? error.message : String(error)}`, null);
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
