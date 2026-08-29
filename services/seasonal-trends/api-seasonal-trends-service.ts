import { createApiClient } from '@/lib/api/api-client';
import type { SeasonalTrendsService } from '@/services/seasonal-trends/seasonal-trends-service';

export const apiSeasonalTrendsService: SeasonalTrendsService = {
  ensure(request) {
    return createApiClient().request('/seasonal-trends/ensure', {
      method: 'POST',
      body: request,
    });
  },
  refresh(request) {
    return createApiClient().request('/seasonal-trends/refresh', {
      method: 'POST',
      body: request,
    });
  },
};
