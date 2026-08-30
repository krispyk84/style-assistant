import { createApiClient } from '@/lib/api/api-client';
import type { SeasonalColorsService } from '@/services/seasonal-colors/seasonal-colors-service';

export const apiSeasonalColorsService: SeasonalColorsService = {
  ensure(request) {
    return createApiClient().request('/seasonal-colors/ensure', {
      method: 'POST',
      body: request,
    });
  },
  refresh(request) {
    return createApiClient().request('/seasonal-colors/refresh', {
      method: 'POST',
      body: request,
    });
  },
  getReport(fashionGender, hemisphere) {
    return createApiClient().request(`/seasonal-colors/report?fashionGender=${fashionGender}&hemisphere=${hemisphere}`);
  },
  setFeedback(request) {
    return createApiClient().request('/seasonal-colors/feedback', {
      method: 'POST',
      body: request,
    });
  },
};
