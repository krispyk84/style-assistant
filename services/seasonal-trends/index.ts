import { canUseRealApi } from '@/lib/api/api-client';
import { apiSeasonalTrendsService } from '@/services/seasonal-trends/api-seasonal-trends-service';
import { mockSeasonalTrendsService } from '@/services/seasonal-trends/mock-seasonal-trends-service';

export const seasonalTrendsService = canUseRealApi() ? apiSeasonalTrendsService : mockSeasonalTrendsService;
