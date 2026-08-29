import type {
  ApiResponse,
  EnsureHaircutTrendsRequest,
  EnsureHaircutTrendsResponse,
  FashionGender,
  GetHaircutTrendsResponse,
} from '@/types/api';
import type { Hemisphere } from '@/types/weather';

export type HaircutTrendsService = {
  /** Called once per Haircut Planner visit. Never blocks the caller. */
  ensure: (request: EnsureHaircutTrendsRequest) => Promise<ApiResponse<EnsureHaircutTrendsResponse>>;
  /** Debug/manual refresh — forces a fresh Gemini call regardless of an existing current profile. */
  refresh: (request: EnsureHaircutTrendsRequest) => Promise<ApiResponse<EnsureHaircutTrendsResponse>>;
  /** Fetches the current (or most recent stale) top-20 style list for the "Hairstyle Trend Report" modal. */
  getCurrent: (fashionGender: FashionGender, hemisphere: Hemisphere) => Promise<ApiResponse<GetHaircutTrendsResponse>>;
};
