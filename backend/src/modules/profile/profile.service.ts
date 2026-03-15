import type { GetProfileResponse, ProfileDto, UpsertProfileRequest } from '../../contracts/profile.contracts.js';
import { profileRepository } from './profile.repository.js';

function mapProfile(profile: Awaited<ReturnType<typeof profileRepository.findLatest>>): GetProfileResponse {
  if (!profile) {
    return null;
  }

  const dto: ProfileDto = {
    id: profile.id,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    fitPreference: profile.fitPreference,
    stylePreference: profile.stylePreference,
    budget: profile.budget,
    hairColor: profile.hairColor,
    skinTone: profile.skinTone,
    notes: profile.notes,
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };

  return dto;
}

export const profileService = {
  async getProfile() {
    const profile = await profileRepository.findLatest();
    return mapProfile(profile);
  },

  async upsertProfile(input: UpsertProfileRequest) {
    const profile = await profileRepository.upsertLatest(input);
    return mapProfile(profile);
  },
};
