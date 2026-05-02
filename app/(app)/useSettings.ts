import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import { usageService } from '@/services/usage';

// ── Constants ──────────────────────────────────────────────────────────────────

export const appVersion = Constants.expoConfig?.version ?? '0.0.1';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSettings() {
  const [sensitivity, setSensitivity] = useState(50);
  const [monthlyAiCost, setMonthlyAiCost] = useState<number | null>(null);

  useEffect(() => {
    void loadAppSettings().then((s) => setSensitivity(s.closetMatchSensitivity));
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

  const sensitivityLabel =
    sensitivity >= 67
      ? 'Precise — same color family AND similar shade required'
      : sensitivity >= 34
        ? 'Balanced — same broad color family required'
        : 'Forgiving — broad color range, focus on category and style';

  return { sensitivity, setSensitivity, persistSensitivity, monthlyAiCost, sensitivityLabel, appVersion };
}
