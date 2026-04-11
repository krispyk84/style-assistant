import * as Location from 'expo-location';

import type { WeatherContext } from '@/types/weather';
import { getSeason, weatherSummaryFromCode, formatLocationLabel } from './weather-response-parser';
import { buildStylingHint } from './weather-styling-hints';

type OpenMeteoResponse = {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
};

export type WeekForecastDay = {
  dayKey: string;
  weatherCode: number;
  highTempC: number;
  lowTempC: number;
};

async function getPosition() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission was not granted.');
  }
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

export async function loadCurrentWeather(): Promise<WeatherContext> {
  const position = await getPosition();

  const { latitude, longitude } = position.coords;

  const [address, weatherResponse] = await Promise.all([
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => results[0])
      .catch(() => undefined),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`
    ),
  ]);

  if (!weatherResponse.ok) {
    throw new Error('Weather service unavailable.');
  }

  const payload = (await weatherResponse.json()) as OpenMeteoResponse;
  const current = payload.current;

  if (!current) {
    throw new Error('Current weather data is unavailable.');
  }

  const season = getSeason();
  const summary = weatherSummaryFromCode(current.weather_code);

  return {
    temperatureC: current.temperature_2m,
    apparentTemperatureC: current.apparent_temperature,
    dailyHighC: payload.daily?.temperature_2m_max[0] ?? null,
    dailyLowC: payload.daily?.temperature_2m_min[0] ?? null,
    weatherCode: current.weather_code,
    season,
    summary,
    stylingHint: buildStylingHint(current.apparent_temperature, season, summary),
    locationLabel: formatLocationLabel(address),
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadNextSevenDayForecast(): Promise<WeekForecastDay[]> {
  const position = await getPosition();

  const { latitude, longitude } = position.coords;

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=8&timezone=auto`
  );

  if (!weatherResponse.ok) {
    throw new Error('Weather service unavailable.');
  }

  const payload = (await weatherResponse.json()) as OpenMeteoResponse;
  const daily = payload.daily;

  if (!daily) {
    throw new Error('Forecast data is unavailable.');
  }

  return daily.time
    .map((dayKey, index) => ({
      dayKey,
      weatherCode: daily.weather_code[index] ?? 0,
      highTempC: daily.temperature_2m_max[index] ?? 0,
      lowTempC: daily.temperature_2m_min[index] ?? 0,
    }))
    .slice(0, 8);
}
