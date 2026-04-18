/**
 * Travel climate inference.
 *
 * Strategy:
 *   • Trip starts within 15 days  → Open-Meteo forecast API (actual conditions)
 *   • Trip starts later            → Open-Meteo historical archive for the same
 *                                    calendar period one year ago (climatological proxy)
 *
 * Both APIs are free with no key required.
 */

import type {
  DressSeason,
  PackingWeatherTag,
  PrecipCharacter,
  TemperatureBand,
  TravelClimateProfile,
} from './travel-climate-types';

// ── API helpers ───────────────────────────────────────────────────────────────

type DailyPayload = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: (number | null)[];
};

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function fetchDailyWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  useArchive: boolean,
): Promise<DailyPayload> {
  const base = useArchive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';

  const params = [
    `latitude=${lat.toFixed(4)}`,
    `longitude=${lng.toFixed(4)}`,
    `start_date=${startDate}`,
    `end_date=${endDate}`,
    'daily=temperature_2m_max,temperature_2m_min,precipitation_sum',
    'timezone=auto',
  ].join('&');

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);

  const json = await res.json();
  if (!json.daily) throw new Error('No daily data in response');
  return json.daily as DailyPayload;
}

// ── Date range resolution ─────────────────────────────────────────────────────

const FORECAST_HORIZON_DAYS = 15;
// Archive lags ~7 days behind today; we go back 2 years if last year's period is still in the future.
const ARCHIVE_LAG_DAYS = 7;

function resolveDateRange(
  departureDate: Date,
  returnDate: Date,
): { start: string; end: string; useArchive: boolean } {
  const today = new Date();
  const msPerDay = 86_400_000;
  const daysUntilDep = (departureDate.getTime() - today.getTime()) / msPerDay;

  if (daysUntilDep <= FORECAST_HORIZON_DAYS) {
    // Use live forecast; cap end date to stay within the forecast window.
    const maxForecast = new Date(today.getTime() + FORECAST_HORIZON_DAYS * msPerDay);
    const end = returnDate < maxForecast ? returnDate : maxForecast;
    return { start: toISODate(departureDate), end: toISODate(end), useArchive: false };
  }

  // Use historical proxy — same calendar period from the previous year.
  const archiveCutoff = new Date(today.getTime() - ARCHIVE_LAG_DAYS * msPerDay);

  function shiftYear(d: Date, yearsBack: number): Date {
    const copy = new Date(d);
    copy.setFullYear(copy.getFullYear() - yearsBack);
    return copy;
  }

  let histStart = shiftYear(departureDate, 1);
  let histEnd = shiftYear(returnDate, 1);

  // If last year's start is still in the future relative to archive, go back another year.
  if (histStart > archiveCutoff) {
    histStart = shiftYear(departureDate, 2);
    histEnd = shiftYear(returnDate, 2);
  }

  // Never ask for dates beyond what the archive holds.
  if (histEnd > archiveCutoff) histEnd = archiveCutoff;
  if (histEnd < histStart) histEnd = histStart;

  return { start: toISODate(histStart), end: toISODate(histEnd), useArchive: true };
}

// ── Climate classification ────────────────────────────────────────────────────

function classifyTemp(avgHighC: number): TemperatureBand {
  if (avgHighC >= 30) return 'hot';
  if (avgHighC >= 23) return 'warm';
  if (avgHighC >= 15) return 'mild';
  if (avgHighC >= 7)  return 'cool';
  return 'cold';
}

function classifyPrecip(mmPerDay: number): PrecipCharacter {
  if (mmPerDay >= 4)   return 'wet';
  if (mmPerDay >= 1.5) return 'variable';
  return 'dry';
}

function resolveDressSeason(
  band: TemperatureBand,
  precip: PrecipCharacter,
  departureMonth: number,  // 0–11
  lat: number,
): DressSeason {
  // Tropical: hot + humid, common within ~25° of the equator.
  if (band === 'hot' && precip !== 'dry' && Math.abs(lat) < 25) return 'tropical';

  // Hemisphere-adjusted month so summer/winter logic is universal.
  const adjustedMonth = lat < 0 ? (departureMonth + 6) % 12 : departureMonth;
  if (adjustedMonth >= 5 && adjustedMonth <= 7) return 'summer';
  if (adjustedMonth >= 11 || adjustedMonth <= 1) return 'winter';
  return 'spring_autumn';
}

function resolvePackingTag(band: TemperatureBand, precip: PrecipCharacter): PackingWeatherTag {
  if (band === 'hot'  && precip !== 'dry') return 'hot_humid';
  if (band === 'hot')                      return 'hot_dry';
  if (band === 'warm' && precip !== 'dry') return 'warm_wet';
  if (band === 'warm')                     return 'warm_dry';
  if (band === 'mild' && precip !== 'dry') return 'mild_wet';
  if (band === 'mild')                     return 'mild_dry';
  if (band === 'cool')                     return 'cool';
  if (precip === 'wet')                    return 'cold_rainy';
  return 'cold';
}

function buildClimateLabel(
  band: TemperatureBand,
  precip: PrecipCharacter,
  season: DressSeason,
  diurnalRangeC: number,
): string {
  if (season === 'tropical') {
    return precip === 'wet' ? 'Hot and humid with rain' : 'Hot and humid';
  }

  const tempWord: Record<TemperatureBand, string> = {
    hot: 'Hot', warm: 'Warm', mild: 'Mild', cool: 'Cool', cold: 'Cold',
  };
  const rainWord: Record<PrecipCharacter, string> = {
    dry: 'and dry',
    variable: 'with some rain',
    wet: 'and rainy',
  };

  let label = `${tempWord[band]} ${rainWord[precip]}`;

  // Big day-to-night swing worth calling out for packing.
  if (diurnalRangeC >= 12 && (band === 'warm' || band === 'mild')) {
    label += ', cooler evenings';
  }
  // Cool/cold trips always benefit from the layering reminder.
  if (band === 'cool' || band === 'cold') {
    label += ', layering recommended';
  }

  return label;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type InferClimateParams = {
  lat: number;
  lng: number;
  departureDate: Date;
  returnDate: Date;
};

export async function inferTravelClimate(params: InferClimateParams): Promise<TravelClimateProfile> {
  const { lat, lng, departureDate, returnDate } = params;
  const { start, end, useArchive } = resolveDateRange(departureDate, returnDate);

  const daily = await fetchDailyWeather(lat, lng, start, end, useArchive);

  const days = daily.time.length;
  if (days === 0) throw new Error('No days in weather response');

  const avgHighC = daily.temperature_2m_max.reduce((s, v) => s + v, 0) / days;
  const avgLowC  = daily.temperature_2m_min.reduce((s, v) => s + v, 0) / days;
  const precipMmPerDay = daily.precipitation_sum.reduce((s, v) => s + (v ?? 0), 0) / days;
  const diurnalRange = avgHighC - avgLowC;

  const tempBand    = classifyTemp(avgHighC);
  const precipChar  = classifyPrecip(precipMmPerDay);
  const dressSeason = resolveDressSeason(tempBand, precipChar, departureDate.getMonth(), lat);
  const packingTag  = resolvePackingTag(tempBand, precipChar);
  const climateLabel = buildClimateLabel(tempBand, precipChar, dressSeason, diurnalRange);

  return {
    avgHighC: Math.round(avgHighC * 10) / 10,
    avgLowC:  Math.round(avgLowC * 10) / 10,
    precipMmPerDay: Math.round(precipMmPerDay * 10) / 10,
    tempBand,
    precipChar,
    dressSeason,
    packingTag,
    climateLabel,
  };
}
