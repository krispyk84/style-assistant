import { useEffect, useState } from 'react';

import { loadAppSettings } from '@/lib/app-settings-storage';

/** Loads trendiness (0–100) from app settings once on mount. */
export function useTrendiness(): number {
  const [trendiness, setTrendiness] = useState(50);

  useEffect(() => {
    void loadAppSettings().then((s) => setTrendiness(s.trendiness));
  }, []);

  return trendiness;
}
