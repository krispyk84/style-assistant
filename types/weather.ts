export type WeatherSeason = 'winter' | 'spring' | 'summer' | 'fall';

export type WeatherContext = {
  temperatureC: number;
  apparentTemperatureC: number;
  /** Today's daily high temperature in Celsius. */
  dailyHighC: number | null;
  /** Today's daily low temperature in Celsius. */
  dailyLowC: number | null;
  weatherCode: number;
  season: WeatherSeason;
  summary: string;
  stylingHint: string;
  locationLabel: string | null;
  fetchedAt: string;
};
