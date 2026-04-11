import type { Dispatch, SetStateAction } from 'react';

import { hasValidationErrors, validateProfile } from '@/lib/profile-validation';
import type { Profile, ProfileValidationErrors } from '@/types/profile';
import {
  buildProfilePayload,
  type HeightUnit,
  type WeightUnit,
} from './profile-form-mappers';

type UseProfileFormSubmitParams = {
  profile: Profile;
  heightUnit: HeightUnit;
  heightFeet: string;
  heightInches: string;
  weightUnit: WeightUnit;
  weightValue: string;
  setErrors: Dispatch<SetStateAction<ProfileValidationErrors>>;
  onSubmit: (profile: Profile) => Promise<void> | void;
};

export function useProfileFormSubmit({
  profile,
  heightUnit,
  heightFeet,
  heightInches,
  weightUnit,
  weightValue,
  setErrors,
  onSubmit,
}: UseProfileFormSubmitParams) {
  async function handleSubmit() {
    const payload = buildProfilePayload(
      profile,
      heightUnit,
      heightFeet,
      heightInches,
      weightUnit,
      weightValue,
    );
    const nextErrors = validateProfile(payload);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) return;
    await onSubmit(payload);
  }

  return { handleSubmit };
}
