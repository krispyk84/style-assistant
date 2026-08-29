import { useState } from 'react';

import { useAppSession } from '@/hooks/use-app-session';
import { loadWeatherContext } from '@/lib/weather-storage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import type { SeasonalTrendReportEntry } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

export function useFashionTrendReport() {
  const { profile } = useAppSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [trends, setTrends] = useState<SeasonalTrendReportEntry[] | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);

    const weatherContext = await loadWeatherContext();
    const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
    const fashionGender = profile.gender === 'woman' ? 'womenswear' : 'menswear';
    const response = await seasonalTrendsService.getReport(fashionGender, hemisphere);

    if (response.success && response.data?.available) {
      setTrends(response.data.trends);
      setIsStale(response.data.isStale);
    } else {
      setTrends(null);
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

  return { isOpen, open, close, isLoading, trends, isStale, error };
}
