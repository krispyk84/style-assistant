import type { GetProfileResponse, ProfileDto, UpsertProfileRequest } from '../../contracts/profile.contracts.js';
import { profileRepository } from './profile.repository.js';

function mapProfile(profile: Awaited<ReturnType<typeof profileRepository.findByUserId>>): GetProfileResponse {
  if (!profile) {
    return null;
  }

  const profileRecord = profile as typeof profile & { summerBottomPreference?: string; temperatureUnit?: string; name?: string; bodyType?: string | null };
  const dto: ProfileDto = {
    id: profileRecord.id,
    name: profileRecord.name ?? '',
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
    bodyType: profileRecord.bodyType ?? null,
    notes: profileRecord.notes,
    onboardingCompleted: profileRecord.onboardingCompleted,
    createdAt: profileRecord.createdAt.toISOString(),
    updatedAt: profileRecord.updatedAt.toISOString(),
  };

  return dto;
}

export const profileService = {
  async getProfile(supabaseUserId: string) {
    const profile = await profileRepository.findByUserId(supabaseUserId);
    return mapProfile(profile);
  },

  async upsertProfile(supabaseUserId: string, input: UpsertProfileRequest) {
    const profile = await profileRepository.upsertByUserId(supabaseUserId, input);
    return mapProfile(profile);
  },
};
