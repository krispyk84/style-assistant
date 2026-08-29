import { loadWeatherContext } from '@/lib/weather-storage';
import { seasonalTrendsService } from '@/services/seasonal-trends';
import type { FashionGender } from '@/types/api';
import type { Hemisphere } from '@/types/weather';

function fashionGenderFor(gender: string | null | undefined): FashionGender {
  return gender === 'woman' ? 'womenswear' : 'menswear';
}

/**
 * Fires the "ensure current seasonal trend profile" check — never blocks the
 * caller and never throws. Reuses the last cached weather fetch for
 * hemisphere/region instead of requesting location access itself; if none is
 * cached yet (fresh install, weather never loaded), defaults to Northern
 * Hemisphere per spec rather than skipping the check.
 */
export function ensureSeasonalTrends(gender: string | null | undefined) {
  void (async () => {
    try {
      const weatherContext = await loadWeatherContext();
      const hemisphere: Hemisphere = weatherContext?.hemisphere ?? 'northern';
      await seasonalTrendsService.ensure({
        fashionGender: fashionGenderFor(gender),
        hemisphere,
        region: weatherContext?.countryCode ?? undefined,
      });
    } catch {
      // Best-effort — the app continues normally on existing/stale trend data either way.
    }
  })();
}
