import type { WeatherSeason } from '@/types/weather';

export function getSeason(date = new Date()): WeatherSeason {
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

const WEATHER_CODE_SUMMARY: Record<number, string> = {
  0: 'Clear',
  1: 'Partly cloudy', 2: 'Partly cloudy', 3: 'Partly cloudy',
  45: 'Foggy', 48: 'Foggy',
  51: 'Drizzly', 53: 'Drizzly', 55: 'Drizzly', 56: 'Drizzly', 57: 'Drizzly',
  61: 'Rainy', 63: 'Rainy', 65: 'Rainy', 66: 'Rainy', 67: 'Rainy',
  80: 'Rainy', 81: 'Rainy', 82: 'Rainy',
  71: 'Snowy', 73: 'Snowy', 75: 'Snowy', 77: 'Snowy', 85: 'Snowy', 86: 'Snowy',
  95: 'Stormy', 96: 'Stormy', 99: 'Stormy',
};

export function weatherSummaryFromCode(code: number): string {
  return WEATHER_CODE_SUMMARY[code] ?? 'Mixed conditions';
}

export function formatLocationLabel(address?: { city?: string | null; region?: string | null; district?: string | null }): string | null {
  if (!address) {
    return null;
  }

  return address.city ?? address.district ?? address.region ?? null;
}
