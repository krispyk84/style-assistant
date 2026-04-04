import { createApiClient } from '@/lib/api/api-client';
import type { SecondOpinionService } from '@/services/second-opinion/second-opinion-service';

export const apiSecondOpinionService: SecondOpinionService = {
  getOpinion(request) {
    return createApiClient().request('/second-opinion', {
      method: 'POST',
      body: request,
    });
  },
};
