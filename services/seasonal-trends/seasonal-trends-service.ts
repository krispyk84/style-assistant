import type {
  ApiResponse,
  EnsureSeasonalTrendsRequest,
  EnsureSeasonalTrendsResponse,
  FashionGender,
  GetSeasonalTrendsReportResponse,
} from '@/types/api';
import type { Hemisphere } from '@/types/weather';

export type SeasonalTrendsService = {
  /** Called once per cold start (and after a fashion-gender change). Never blocks the caller. */
  ensure: (request: EnsureSeasonalTrendsRequest) => Promise<ApiResponse<EnsureSeasonalTrendsResponse>>;
  /** Debug/manual refresh — forces a fresh Gemini call regardless of an existing current profile. */
  refresh: (request: EnsureSeasonalTrendsRequest) => Promise<ApiResponse<EnsureSeasonalTrendsResponse>>;
  /** Fetches the current top-20 "Fashion Trend Report" for display. */
  getReport: (fashionGender: FashionGender, hemisphere: Hemisphere) => Promise<ApiResponse<GetSeasonalTrendsReportResponse>>;
};
