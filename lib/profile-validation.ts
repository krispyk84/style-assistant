import type { Profile, ProfileValidationErrors } from '@/types/profile';

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function validateProfile(profile: Profile): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!isPositiveNumber(profile.heightCm)) {
    errors.heightCm = 'Enter a valid height in centimeters.';
  }

  if (!isPositiveNumber(profile.weightKg)) {
    errors.weightKg = 'Enter a valid weight in kilograms.';
  }

  if (profile.notes.length > 240) {
    errors.notes = 'Keep notes under 240 characters.';
  }

  return errors;
}

export function hasValidationErrors(errors: ProfileValidationErrors) {
  return Object.keys(errors).length > 0;
}
