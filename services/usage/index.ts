import { createApiClient } from '@/lib/api/api-client';
import type { ApiResponse } from '@/types/api';

export const usageService = {
  async getMonthlyTotal(): Promise<ApiResponse<{ totalCostUsd: number }>> {
    return createApiClient().request<{ totalCostUsd: number }>('/usage/monthly');
  },
};
