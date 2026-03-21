import type { GetProfileResponse, ProfileDto, UpsertProfileRequest } from '../../contracts/profile.contracts.js';
import { profileRepository } from './profile.repository.js';

function mapProfile(profile: Awaited<ReturnType<typeof profileRepository.findLatest>>): GetProfileResponse {
  if (!profile) {
    return null;
  }

  const profileRecord = profile as typeof profile & { summerBottomPreference?: string; temperatureUnit?: string };
  const dto: ProfileDto = {
    id: profileRecord.id,
    gender: profileRecord.gender,
    heightCm: profileRecord.heightCm,
    weightKg: profileRecord.weightKg,
    fitPreference: profileRecord.fitPreference,
    stylePreference: profileRecord.stylePreference,
    budget: profileRecord.budget,
    hairColor: profileRecord.hairColor,
    skinTone: profileRecord.skinTone,
    summerBottomPreference: profileRecord.summerBottomPreference ?? 'prefer-trousers',
    temperatureUnit: profileRecord.temperatureUnit ?? 'celsius',
    notes: profileRecord.notes,
    onboardingCompleted: profileRecord.onboardingCompleted,
    createdAt: profileRecord.createdAt.toISOString(),
    updatedAt: profileRecord.updatedAt.toISOString(),
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
