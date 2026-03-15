import { createApiClient } from '@/lib/api/api-client';
import type { ApiResponse, ProfileSessionResponse } from '@/types/api';
import type { Profile } from '@/types/profile';
import type { ProfileService } from '@/services/profile/profile-service';

type BackendProfileDto = {
  id: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  fitPreference: string;
  stylePreference: string;
  budget: string;
  hairColor: string;
  skinTone: string;
  notes: string | null;
  onboardingCompleted: boolean;
};

function toProfile(dto: BackendProfileDto): Profile {
  return {
    gender: dto.gender as Profile['gender'],
    heightCm: String(dto.heightCm),
    weightKg: String(dto.weightKg),
    fitPreference: dto.fitPreference as Profile['fitPreference'],
    stylePreference: dto.stylePreference as Profile['stylePreference'],
    budget: dto.budget as Profile['budget'],
    hairColor: dto.hairColor as Profile['hairColor'],
    skinTone: dto.skinTone as Profile['skinTone'],
    notes: dto.notes ?? '',
  };
}

export const apiProfileService: ProfileService = {
  async loadSession(): Promise<ApiResponse<ProfileSessionResponse>> {
    const response = await createApiClient().request<BackendProfileDto | null>('/profile');

    if (!response.success) {
      return {
        success: false,
        data: null,
        error: response.error,
      };
    }

    if (!response.data) {
      return {
        success: true,
        data: {
          onboardingCompleted: false,
          profile: null,
        },
        error: null,
      };
    }

    return {
      success: true,
      data: {
        onboardingCompleted: response.data.onboardingCompleted,
        profile: toProfile(response.data),
      },
      error: null,
    };
  },

  async saveProfile(request): Promise<ApiResponse<ProfileSessionResponse>> {
    const response = await createApiClient().request<BackendProfileDto>('/profile', {
      method: 'POST',
      body: {
        gender: request.profile.gender,
        heightCm: Number(request.profile.heightCm),
        weightKg: Number(request.profile.weightKg),
        fitPreference: request.profile.fitPreference,
        stylePreference: request.profile.stylePreference,
        budget: request.profile.budget,
        hairColor: request.profile.hairColor,
        skinTone: request.profile.skinTone,
        notes: request.profile.notes,
        onboardingCompleted: request.onboardingCompleted,
      },
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        data: null,
        error: response.error,
      };
    }

    return {
      success: true,
      data: {
        onboardingCompleted: response.data.onboardingCompleted,
        profile: toProfile(response.data),
      },
      error: null,
    };
  },
};
