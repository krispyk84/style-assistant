import { canUseRealApi } from '@/lib/api/api-client';
import { apiHaircutService } from '@/services/haircut/api-haircut-service';
import { mockHaircutService } from '@/services/haircut/mock-haircut-service';

export const haircutService = canUseRealApi() ? apiHaircutService : mockHaircutService;
