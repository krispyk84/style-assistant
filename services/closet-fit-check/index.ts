import { canUseRealApi } from '@/lib/api/api-client';
import { apiClosetFitCheckService } from './api-closet-fit-check-service';
import { mockClosetFitCheckService } from './mock-closet-fit-check-service';

export const closetFitCheckService = canUseRealApi() ? apiClosetFitCheckService : mockClosetFitCheckService;
