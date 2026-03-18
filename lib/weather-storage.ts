import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WeatherContext } from '@/types/weather';

const STORAGE_KEY = 'style-assistant/weather-context';

export async function loadWeatherContext(): Promise<WeatherContext | null> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as WeatherContext;
  } catch {
    return null;
  }
}

export async function saveWeatherContext(weatherContext: WeatherContext) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(weatherContext));
  return weatherContext;
}
