import { useState } from 'react';

import { loadWeatherContext } from '@/lib/weather-storage';
import { haircutTrendsService } from '@/services/haircut-trends';
import type { HaircutTrendStyle } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

export function useHairstyleTrendReport() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [styles, setStyles] = useState<HaircutTrendStyle[] | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);

    const weatherContext = await loadWeatherContext();
    const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
    const response = await haircutTrendsService.getCurrent(hemisphere);

    if (response.success && response.data?.available) {
      setStyles(response.data.styles);
      setIsStale(response.data.isStale);
    } else {
      setStyles(null);
      setError(
        response.success
          ? 'This season\'s trend report is still being put together — check back soon.'
          : (response.error?.message ?? 'Could not load the trend report.'),
      );
    }
    setIsLoading(false);
  }

  function close() {
    setIsOpen(false);
  }

  return { isOpen, open, close, isLoading, styles, isStale, error };
}
