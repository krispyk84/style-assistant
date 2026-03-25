import { canUseRealApi } from '@/lib/api/api-client';
import { apiClosetService } from '@/services/closet/api-closet-service';
import { mockClosetService } from '@/services/closet/mock-closet-service';

export const closetService = canUseRealApi() ? apiClosetService : mockClosetService;
