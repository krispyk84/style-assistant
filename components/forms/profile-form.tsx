import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { defaultProfile } from '@/lib/default-profile';
import { hasValidationErrors, validateProfile } from '@/lib/profile-validation';
import type { Profile, ProfileValidationErrors } from '@/types/profile';
import {
  BUDGET_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  GENDER_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
} from '@/types/profile';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';

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
  const [profile, setProfile] = useState(initialValue);
  const [errors, setErrors] = useState<ProfileValidationErrors>({});

  useEffect(() => {
    setProfile(initialValue);
  }, [initialValue]);

  async function handleSubmit() {
    const nextErrors = validateProfile(profile);
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    await onSubmit(profile);
  }

  function updateField<Key extends keyof Profile>(key: Key, value: Profile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <FormField label="Gender" hint="Used to tailor fit and style guidance.">
        <SegmentedControl options={GENDER_OPTIONS} value={profile.gender} onChange={(value) => updateField('gender', value)} />
      </FormField>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <FormField label="Height" hint="Centimeters work best here." error={errors.heightCm as string | undefined}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => updateField('heightCm', value.replace(/[^0-9]/g, ''))}
              placeholder="183"
              placeholderTextColor={theme.colors.subtleText}
              style={inputStyle}
              value={profile.heightCm}
            />
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Weight" hint="Enter kilograms." error={errors.weightKg as string | undefined}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => updateField('weightKg', value.replace(/[^0-9]/g, ''))}
              placeholder="79"
              placeholderTextColor={theme.colors.subtleText}
              style={inputStyle}
              value={profile.weightKg}
            />
          </FormField>
        </View>
      </View>

      <FormField label="Fit preference" hint="How you want clothes to sit on the body.">
        <SegmentedControl
          options={FIT_PREFERENCE_OPTIONS}
          value={profile.fitPreference}
          onChange={(value) => updateField('fitPreference', value)}
        />
      </FormField>

      <FormField label="Style preference" hint="Pick the closest overall direction.">
        <SegmentedControl
          options={STYLE_PREFERENCE_OPTIONS}
          value={profile.stylePreference}
          onChange={(value) => updateField('stylePreference', value)}
        />
      </FormField>

      <FormField label="Budget" hint="Helps future recommendations stay realistic.">
        <SegmentedControl options={BUDGET_OPTIONS} value={profile.budget} onChange={(value) => updateField('budget', value)} />
      </FormField>

      <FormField label="Hair color" hint="Useful for palette and contrast cues.">
        <SegmentedControl
          options={HAIR_COLOR_OPTIONS}
          value={profile.hairColor}
          onChange={(value) => updateField('hairColor', value)}
        />
      </FormField>

      <FormField label="Skin tone" hint="Used later for color guidance.">
        <SegmentedControl
          options={SKIN_TONE_OPTIONS}
          value={profile.skinTone}
          onChange={(value) => updateField('skinTone', value)}
        />
      </FormField>

      <FormField label="Notes" hint="Optional context like profession, climate, or wardrobe pain points." error={errors.notes as string | undefined}>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={(value) => updateField('notes', value)}
          placeholder="Optional notes"
          placeholderTextColor={theme.colors.subtleText}
          style={[inputStyle, { minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }]}
          value={profile.notes}
        />
      </FormField>

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton disabled={disabled} label={disabled ? 'Saving...' : submitLabel} onPress={handleSubmit} />
        <AppText tone="muted">Your profile is stored locally on device for this prototype.</AppText>
      </View>
    </View>
  );
}

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 16,
  minHeight: 54,
  paddingHorizontal: spacing.md,
} as const;
