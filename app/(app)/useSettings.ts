import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import { fetchCloudBackupStatus } from '@/lib/cloud-backup-status';
import { loadWeatherContext } from '@/lib/weather-storage';
import { usageService } from '@/services/usage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import type { FashionGender } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

// ── Constants ──────────────────────────────────────────────────────────────────

export const appVersion = Constants.expoConfig?.version ?? '0.0.1';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSettings() {
  const { profile } = useAppSession();
  const [sensitivity, setSensitivity] = useState(50);
  const [trendiness, setTrendiness] = useState(50);
  const [monthlyAiCost, setMonthlyAiCost] = useState<number | null>(null);
  const [isRefreshingTrends, setIsRefreshingTrends] = useState(false);
  const [trendsRefreshMessage, setTrendsRefreshMessage] = useState<string | null>(null);
  const [isCheckingCloudBackup, setIsCheckingCloudBackup] = useState(false);
  const [cloudBackupMessage, setCloudBackupMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAppSettings().then((s) => {
      setSensitivity(s.closetMatchSensitivity);
      setTrendiness(s.trendiness);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      void usageService.getMonthlyTotal().then((r) => {
        if (isMounted && r.success && r.data) setMonthlyAiCost(r.data.totalCostUsd);
      });
      return () => { isMounted = false; };
    }, [])
  );

  async function persistSensitivity(value: number) {
    await saveAppSettings({ closetMatchSensitivity: value });
  }

  async function persistTrendiness(value: number) {
    await saveAppSettings({ trendiness: value });
  }

  async function refreshSeasonalTrends() {
    setIsRefreshingTrends(true);
    setTrendsRefreshMessage(null);
    try {
      const weatherContext = await loadWeatherContext();
      const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
      const fashionGender: FashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';
      const response = await seasonalTrendsService.refresh({
        fashionGender,
        hemisphere,
        region: weatherContext?.countryCode ?? undefined,
      });
      setTrendsRefreshMessage(
        response.success
          ? 'Refresh requested — new trends will be available shortly.'
          : (response.error?.message ?? 'Could not request a refresh.'),
      );
    } catch {
      setTrendsRefreshMessage('Could not request a refresh.');
    }
    setIsRefreshingTrends(false);
  }

  async function checkCloudBackupStatus() {
    setIsCheckingCloudBackup(true);
    setCloudBackupMessage(null);
    try {
      const result = await fetchCloudBackupStatus();
      setCloudBackupMessage(
        result.ok
          ? `Saved outfits: ${result.status.savedOutfitsInCloud} · Closet items: ${result.status.closetItemsInCloud} · Week plan: ${result.status.weekPlanInCloud} · Closet-outfit favourites: ${result.status.closetOutfitFavouritesInCloud} · Closet-outfit week plan: ${result.status.closetOutfitWeekPlanInCloud}`
          : `Error: ${result.message}`,
      );
    } catch (error) {
      setCloudBackupMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error.'}`);
    }
    setIsCheckingCloudBackup(false);
  }

  const sensitivityLabel =
    sensitivity >= 67
      ? 'Precise — same color family AND similar shade required'
      : sensitivity >= 34
        ? 'Balanced — same broad color family required'
        : 'Forgiving — broad color range, focus on category and style';

  const trendinessLabel =
    trendiness >= 67
      ? 'Trendy — current micro-trends, statement details, fashion-forward pieces'
      : trendiness >= 34
        ? 'Balanced — mix of timeless staples and current pieces'
        : 'Safe — established silhouettes, neutral palettes, timeless wardrobe staples';

  return {
    sensitivity, setSensitivity, persistSensitivity, sensitivityLabel,
    trendiness, setTrendiness, persistTrendiness, trendinessLabel,
    monthlyAiCost, appVersion,
    isRefreshingTrends, trendsRefreshMessage, refreshSeasonalTrends,
    isCheckingCloudBackup, cloudBackupMessage, checkCloudBackupStatus,
  };
}
