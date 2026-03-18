export type WeatherSeason = 'winter' | 'spring' | 'summer' | 'fall';

export type WeatherContext = {
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  season: WeatherSeason;
  summary: string;
  stylingHint: string;
  locationLabel: string | null;
  fetchedAt: string;
};
