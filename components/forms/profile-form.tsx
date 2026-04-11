import { defaultProfile } from '@/lib/default-profile';
import type { Profile } from '@/types/profile';
import { ProfileFormView } from './ProfileFormView';
import { useProfileForm } from './useProfileForm';
import { useProfileFormSubmit } from './useProfileFormSubmit';

type ProfileFormProps = {
  initialValue?: Profile;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (profile: Profile) => Promise<void> | void;
};

export function ProfileForm({
  initialValue = defaultProfile,
  submitLabel,
  disabled = false,
  onSubmit,
}: ProfileFormProps) {
  const formHook = useProfileForm(initialValue);

  const { handleSubmit } = useProfileFormSubmit({
    profile: formHook.profile,
    heightUnit: formHook.heightUnit,
    heightFeet: formHook.heightFeet,
    heightInches: formHook.heightInches,
    weightUnit: formHook.weightUnit,
    weightValue: formHook.weightValue,
    setErrors: formHook.setErrors,
    onSubmit,
  });

  return (
    <ProfileFormView
      profile={formHook.profile}
      heightUnit={formHook.heightUnit}
      heightFeet={formHook.heightFeet}
      heightInches={formHook.heightInches}
      weightUnit={formHook.weightUnit}
      weightValue={formHook.weightValue}
      errors={formHook.errors}
      pickerField={formHook.pickerField}
      pickerConfigs={formHook.pickerConfigs}
      setHeightFeet={formHook.setHeightFeet}
      setHeightInches={formHook.setHeightInches}
      setWeightValue={formHook.setWeightValue}
      setPickerField={formHook.setPickerField}
      updateField={formHook.updateField}
      handleHeightUnitChange={formHook.handleHeightUnitChange}
      handleWeightUnitChange={formHook.handleWeightUnitChange}
      handleSubmit={handleSubmit}
      submitLabel={submitLabel}
      disabled={disabled}
    />
  );
}
