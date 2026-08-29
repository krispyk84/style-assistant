export type Hemisphere = 'northern' | 'southern';
export type FashionSeason = 'winter' | 'spring' | 'summer' | 'fall';

// Deliberately separate from services/weather/weather-response-parser.ts's
// getSeason() on the frontend — that one is hardcoded Northern-hemisphere-only
// (used for weather styling hints, unrelated to this feature) and changing it
// would affect existing behavior. These boundaries match it exactly for the
// Northern case; Southern mirrors by shifting 6 months.
//
// Northern: Spring Mar 1, Summer Jun 1, Fall Sep 1, Winter Dec 1.
// Southern: Fall Mar 1, Winter Jun 1, Spring Sep 1, Summer Dec 1.
export function getFashionSeason(date: Date, hemisphere: Hemisphere): { season: FashionSeason; year: number } {
  const month = date.getUTCMonth() + 1; // 1-12
  const calendarYear = date.getUTCFullYear();

  const northernSeason: FashionSeason =
    month === 12 || month <= 2 ? 'winter' :
    month <= 5 ? 'spring' :
    month <= 8 ? 'summer' :
    'fall';

  // A season that starts in December is named for the year it started in —
  // Jan/Feb still belong to the December-starting season, so attribute them
  // back to the previous calendar year rather than minting a "new" season
  // every January 1st.
  const year = month <= 2 ? calendarYear - 1 : calendarYear;

  if (hemisphere === 'northern') {
    return { season: northernSeason, year };
  }

  // Southern hemisphere: same month boundaries, opposite season names.
  const SOUTHERN_MAP: Record<FashionSeason, FashionSeason> = {
    winter: 'summer',
    spring: 'fall',
    summer: 'winter',
    fall: 'spring',
  };
  return { season: SOUTHERN_MAP[northernSeason], year };
}

export function hemisphereFromLatitude(latitude: number | null | undefined): Hemisphere {
  if (typeof latitude !== 'number' || Number.isNaN(latitude)) return 'northern';
  return latitude < 0 ? 'southern' : 'northern';
}
