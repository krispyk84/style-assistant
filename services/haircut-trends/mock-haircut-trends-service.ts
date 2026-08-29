import type { HaircutTrendsService } from '@/services/haircut-trends/haircut-trends-service';

export const mockHaircutTrendsService: HaircutTrendsService = {
  async ensure() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
  async refresh() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
  async getCurrent() {
    return { success: true, data: { available: false }, error: null };
  },
};
