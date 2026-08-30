import type { SeasonalColorsService } from '@/services/seasonal-colors/seasonal-colors-service';

export const mockSeasonalColorsService: SeasonalColorsService = {
  async ensure() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
  async refresh() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
  async getReport() {
    return { success: true, data: { available: false }, error: null };
  },
  async setFeedback() {
    return { success: true, data: { acknowledged: true }, error: null };
  },
};
