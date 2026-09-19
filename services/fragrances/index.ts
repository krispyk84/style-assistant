import { canUseRealApi } from '@/lib/api/api-client';
import { apiFragrancesService } from '@/services/fragrances/api-fragrances-service';
import { mockFragrancesService } from '@/services/fragrances/mock-fragrances-service';

export const fragrancesService = canUseRealApi() ? apiFragrancesService : mockFragrancesService;
export type { FragrancesService } from './fragrances-service';
