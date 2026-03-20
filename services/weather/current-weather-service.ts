import * as Location from 'expo-location';

import type { WeatherContext, WeatherSeason } from '@/types/weather';

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
  };
};

export type WeekForecastDay = {
  dayKey: string;
  weatherCode: number;
  highTempC: number;
};

function getSeason(date = new Date()): WeatherSeason {
  const month = date.getMonth() + 1;

  if (month === 12 || month <= 2) {
    return 'winter';
  }

  if (month >= 3 && month <= 5) {
    return 'spring';
  }

  if (month >= 6 && month <= 8) {
    return 'summer';
  }

  return 'fall';
}

function weatherSummaryFromCode(code: number) {
  if ([0].includes(code)) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzly';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rainy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy';
  if ([95, 96, 99].includes(code)) return 'Stormy';
  return 'Mixed conditions';
}

function buildStylingHint(temperatureC: number, season: WeatherSeason, summary: string) {
  if (temperatureC <= 5 || season === 'winter') {
    return 'Lean into winter layers, warmer textures, and weather-ready shoes.';
  }

  if (temperatureC >= 25 || season === 'summer') {
    return 'Favor breathable fabrics, lighter colors, and warm-weather proportions.';
  }

  if (season === 'spring') {
    return 'Use transitional layers, lighter outerwear, and spring-friendly color contrast.';
  }

  if (season === 'fall') {
    return 'Use richer textures, layered depth, and cooler-weather tailoring.';
  }

  return `Dress for ${summary.toLowerCase()} conditions with practical seasonal layering.`;
}

function formatLocationLabel(address?: { city?: string | null; region?: string | null; district?: string | null }) {
  if (!address) {
    return null;
  }

  return address.city ?? address.district ?? address.region ?? null;
}

export async function loadCurrentWeather(): Promise<WeatherContext> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Location permission was not granted.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const [address, weatherResponse] = await Promise.all([
    Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }).then((results) => results[0]).catch(() => undefined),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`
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
    weatherCode: current.weather_code,
    season,
    summary,
    stylingHint: buildStylingHint(current.apparent_temperature, season, summary),
    locationLabel: formatLocationLabel(address),
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadNextSevenDayForecast(): Promise<WeekForecastDay[]> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Location permission was not granted.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&daily=weather_code,temperature_2m_max&forecast_days=8&timezone=auto`
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
      weatherCode: daily.weather_code[index],
      highTempC: daily.temperature_2m_max[index],
    }))
    .slice(1, 8);
}
