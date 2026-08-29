export type WeatherSeason = 'winter' | 'spring' | 'summer' | 'fall';
export type Hemisphere = 'northern' | 'southern';

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
  /** Derived from GPS latitude sign — used for seasonal fashion trend lookup, not weather styling. */
  hemisphere: Hemisphere | null;
  /** Derived from reverse-geocoded address — used for seasonal fashion trend lookup, not weather styling. */
  countryCode: string | null;
};
