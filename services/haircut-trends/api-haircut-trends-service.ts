import { createApiClient } from '@/lib/api/api-client';
import type { HaircutTrendsService } from '@/services/haircut-trends/haircut-trends-service';

export const apiHaircutTrendsService: HaircutTrendsService = {
  ensure(request) {
    return createApiClient().request('/haircut-trends/ensure', {
      method: 'POST',
      body: request,
    });
  },
  refresh(request) {
    return createApiClient().request('/haircut-trends/refresh', {
      method: 'POST',
      body: request,
    });
  },
  getCurrent(hemisphere) {
    return createApiClient().request(`/haircut-trends/current?hemisphere=${hemisphere}`);
  },
};
