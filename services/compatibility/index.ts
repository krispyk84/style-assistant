import { canUseRealApi } from '@/lib/api/api-client';
import { apiCompatibilityService } from '@/services/compatibility/api-compatibility-service';
import { mockCompatibilityService } from '@/services/compatibility/mock-compatibility-service';

export const compatibilityService = canUseRealApi() ? apiCompatibilityService : mockCompatibilityService;
