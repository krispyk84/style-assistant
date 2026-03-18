import { useEffect, useState } from 'react';

import { loadWeatherContext as loadStoredWeatherContext, saveWeatherContext } from '@/lib/weather-storage';
import { loadCurrentWeather } from '@/services/weather/current-weather-service';
import type { WeatherContext } from '@/types/weather';

export function useCurrentWeather() {
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateWeather() {
      const cachedWeather = await loadStoredWeatherContext();

      if (isMounted && cachedWeather) {
        setWeather(cachedWeather);
        setIsLoading(false);
      }

      try {
        const nextWeather = await loadCurrentWeather();

        if (!isMounted) {
          return;
        }

        setWeather(nextWeather);
        setErrorMessage(null);
        setIsLoading(false);
        await saveWeatherContext(nextWeather);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (!cachedWeather) {
          setIsLoading(false);
        }

        setErrorMessage(error instanceof Error ? error.message : 'Could not load weather.');
      }
    }

    void hydrateWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  return { weather, isLoading, errorMessage };
}
