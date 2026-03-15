import { canUseRealApi } from '@/lib/api/api-client';
import { apiProfileService } from '@/services/profile/api-profile-service';
import { mockProfileService } from '@/services/profile/mock-profile-service';

export const profileService = canUseRealApi() ? apiProfileService : mockProfileService;
