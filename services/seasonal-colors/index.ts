import { canUseRealApi } from '@/lib/api/api-client';
import { apiSeasonalColorsService } from '@/services/seasonal-colors/api-seasonal-colors-service';
import { mockSeasonalColorsService } from '@/services/seasonal-colors/mock-seasonal-colors-service';

export const seasonalColorsService = canUseRealApi() ? apiSeasonalColorsService : mockSeasonalColorsService;
