import { loadSession as loadStoredSession, saveProfile as saveStoredProfile } from '@/lib/profile-storage';
import type { ApiResponse, ProfileSessionResponse, ProfileUpsertRequest } from '@/types/api';
import type { ProfileService } from '@/services/profile/profile-service';

export const mockProfileService: ProfileService = {
  async loadSession(): Promise<ApiResponse<ProfileSessionResponse>> {
    try {
      const session = await loadStoredSession();

      return {
        success: true,
        data: session,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PROFILE_LOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to load local profile session.',
        },
      };
    }
  },

  async saveProfile(request: ProfileUpsertRequest): Promise<ApiResponse<ProfileSessionResponse>> {
    try {
      const session = await saveStoredProfile(request.profile, request.onboardingCompleted);

      return {
        success: true,
        data: session,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PROFILE_SAVE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to save local profile session.',
        },
      };
    }
  },
};
