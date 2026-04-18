/** How warm the trip will feel, based on average daily high. */
export type TemperatureBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

/** How rainy the destination typically is during the trip period. */
export type PrecipCharacter = 'dry' | 'variable' | 'wet';

/** Dress-season tag — drives wardrobe and packing suggestions downstream. */
export type DressSeason = 'summer' | 'spring_autumn' | 'winter' | 'tropical';

/**
 * Machine-readable packing tag for outfit generation logic.
 * Maps to a specific wardrobe strategy.
 */
export type PackingWeatherTag =
  | 'hot_dry'
  | 'hot_humid'
  | 'warm_dry'
  | 'warm_wet'
  | 'mild_dry'
  | 'mild_wet'
  | 'cool'
  | 'cold'
  | 'cold_rainy';

export type TravelClimateProfile = {
  /** Average daily high temperature in °C */
  avgHighC: number;
  /** Average daily low temperature in °C */
  avgLowC: number;
  /** Average precipitation in mm/day */
  precipMmPerDay: number;
  tempBand: TemperatureBand;
  precipChar: PrecipCharacter;
  dressSeason: DressSeason;
  /** Machine-readable tag for outfit/packing recommendation logic */
  packingTag: PackingWeatherTag;
  /** Short human-readable string — auto-populates the "Expected weather / climate" form field */
  climateLabel: string;
};
