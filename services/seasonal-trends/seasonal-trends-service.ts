import type { ApiResponse, EnsureSeasonalTrendsRequest, EnsureSeasonalTrendsResponse } from '@/types/api';

export type SeasonalTrendsService = {
  /** Called once per cold start (and after a fashion-gender change). Never blocks the caller. */
  ensure: (request: EnsureSeasonalTrendsRequest) => Promise<ApiResponse<EnsureSeasonalTrendsResponse>>;
  /** Debug/manual refresh — forces a fresh Gemini call regardless of an existing current profile. */
  refresh: (request: EnsureSeasonalTrendsRequest) => Promise<ApiResponse<EnsureSeasonalTrendsResponse>>;
};
