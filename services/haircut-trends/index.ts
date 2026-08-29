import { canUseRealApi } from '@/lib/api/api-client';
import { apiHaircutTrendsService } from '@/services/haircut-trends/api-haircut-trends-service';
import { mockHaircutTrendsService } from '@/services/haircut-trends/mock-haircut-trends-service';

export const haircutTrendsService = canUseRealApi() ? apiHaircutTrendsService : mockHaircutTrendsService;
