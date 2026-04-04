import { canUseRealApi } from '@/lib/api/api-client';
import { apiSecondOpinionService } from '@/services/second-opinion/api-second-opinion-service';
import { mockSecondOpinionService } from '@/services/second-opinion/mock-second-opinion-service';

export const secondOpinionService = canUseRealApi() ? apiSecondOpinionService : mockSecondOpinionService;
