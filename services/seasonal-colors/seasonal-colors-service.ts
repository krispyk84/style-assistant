import type {
  ApiResponse,
  EnsureSeasonalColorsRequest,
  EnsureSeasonalColorsResponse,
  FashionGender,
  GetSeasonalColorsReportResponse,
} from '@/types/api';
import type { Hemisphere } from '@/types/weather';

export type SeasonalColorsService = {
  /** Called once per Fashion Trend Report visit. Never blocks the caller. */
  ensure: (request: EnsureSeasonalColorsRequest) => Promise<ApiResponse<EnsureSeasonalColorsResponse>>;
  /** Debug/manual refresh — forces a fresh Gemini call regardless of an existing current palette. */
  refresh: (request: EnsureSeasonalColorsRequest) => Promise<ApiResponse<EnsureSeasonalColorsResponse>>;
  /** Fetches the current top-10 seasonal colour palette for display. */
  getReport: (fashionGender: FashionGender, hemisphere: Hemisphere) => Promise<ApiResponse<GetSeasonalColorsReportResponse>>;
};
