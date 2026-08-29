import type { SeasonalTrendsService } from '@/services/seasonal-trends/seasonal-trends-service';

export const mockSeasonalTrendsService: SeasonalTrendsService = {
  async ensure() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
  async refresh() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
};
