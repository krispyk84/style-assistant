export type ProfileDto = {
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
  notes: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GetProfileResponse = ProfileDto | null;

export type UpsertProfileRequest = {
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
  notes?: string;
  onboardingCompleted: boolean;
};

export type UpsertProfileResponse = ProfileDto;
