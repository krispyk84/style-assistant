import { createApiClient } from '@/lib/api/api-client';
import type { ApiResponse, ProfileSessionResponse } from '@/types/api';
import type { Profile } from '@/types/profile';
import type { ProfileService } from '@/services/profile/profile-service';

type BackendProfileDto = {
  id: string;
  name: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  fitPreference: string;
  stylePreference: string;
  budget: string;
  hairColor: string;
  skinTone: string;
  summerBottomPreference: string;
  temperatureUnit: string;
  bodyType: string | null;
  fitTendency: string | null;
  notes: string | null;
  onboardingCompleted: boolean;
};

function toProfile(dto: BackendProfileDto): Profile {
  return {
    name: dto.name ?? '',
    gender: dto.gender as Profile['gender'],
    heightCm: String(Math.round(dto.heightCm)),
    weightKg: String(Math.round(dto.weightKg)),
    fitPreference: dto.fitPreference as Profile['fitPreference'],
    stylePreference: dto.stylePreference as Profile['stylePreference'],
    budget: dto.budget as Profile['budget'],
    hairColor: dto.hairColor as Profile['hairColor'],
    skinTone: dto.skinTone as Profile['skinTone'],
    summerBottomPreference: dto.summerBottomPreference as Profile['summerBottomPreference'],
    temperatureUnit: (dto.temperatureUnit as Profile['temperatureUnit']) ?? 'celsius',
    bodyType: (dto.bodyType as Profile['bodyType']) ?? undefined,
    fitTendency: (dto.fitTendency as Profile['fitTendency']) ?? undefined,
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
        name: request.profile.name,
        gender: request.profile.gender,
        heightCm: parseFloat(request.profile.heightCm) || 0,
        weightKg: parseFloat(request.profile.weightKg) || 0,
        fitPreference: request.profile.fitPreference,
        stylePreference: request.profile.stylePreference,
        budget: request.profile.budget,
        hairColor: request.profile.hairColor,
        skinTone: request.profile.skinTone,
        summerBottomPreference: request.profile.summerBottomPreference,
        temperatureUnit: request.profile.temperatureUnit,
        bodyType: request.profile.bodyType,
        fitTendency: request.profile.fitTendency,
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
