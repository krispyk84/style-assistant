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
  SUMMER_BOTTOM_OPTIONS,
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

type WeightUnit = 'kg' | 'lbs';

function kilogramsToPounds(value: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  return Math.round(numeric * 2.20462).toString();
}

function poundsToKilograms(value: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  return Math.round(numeric / 2.20462).toString();
}

export function ProfileForm({
  initialValue = defaultProfile,
  submitLabel,
  disabled = false,
  onSubmit,
}: ProfileFormProps) {
  const [profile, setProfile] = useState(initialValue);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weightValue, setWeightValue] = useState(initialValue.weightKg);
  const [errors, setErrors] = useState<ProfileValidationErrors>({});

  useEffect(() => {
    setProfile(initialValue);
    setWeightUnit('kg');
    setWeightValue(initialValue.weightKg);
  }, [initialValue]);

  async function handleSubmit() {
    const normalizedProfile = {
      ...profile,
      weightKg: weightUnit === 'lbs' ? poundsToKilograms(weightValue) : weightValue,
    };
    const nextErrors = validateProfile(normalizedProfile);
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    await onSubmit(normalizedProfile);
  }

  function updateField<Key extends keyof Profile>(key: Key, value: Profile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleWeightUnitChange(nextUnit: string) {
    if (nextUnit !== 'kg' && nextUnit !== 'lbs') {
      return;
    }

    if (nextUnit === weightUnit) {
      return;
    }

    setWeightValue((current) => {
      if (!current) {
        return current;
      }

      return nextUnit === 'lbs' ? kilogramsToPounds(current) : poundsToKilograms(current);
    });
    setWeightUnit(nextUnit);
    setErrors((current) => {
      const next = { ...current };
      delete next.weightKg;
      return next;
    });
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <FormField label="Gender" hint="Used to tailor fit and style guidance.">
        <SegmentedControl options={GENDER_OPTIONS} value={profile.gender} onChange={(value) => updateField('gender', value)} />
      </FormField>

      <FormField label="Height" hint="Enter your height in centimeters." error={errors.heightCm as string | undefined}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => updateField('heightCm', value.replace(/[^0-9]/g, ''))}
          placeholder="183"
          placeholderTextColor={theme.colors.subtleText}
          style={inputStyle}
          value={profile.heightCm}
        />
      </FormField>

      <FormField label="Weight" hint="Switch between kilograms and pounds anytime." error={errors.weightKg as string | undefined}>
        <View style={{ gap: spacing.md }}>
          <SegmentedControl options={['kg', 'lbs']} value={weightUnit} onChange={handleWeightUnitChange} />
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setWeightValue(value.replace(/[^0-9]/g, ''))}
            placeholder={weightUnit === 'kg' ? '79' : '174'}
            placeholderTextColor={theme.colors.subtleText}
            style={inputStyle}
            value={weightValue}
          />
        </View>
      </FormField>

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

      <FormField label="Warm weather bottoms" hint="Choose whether summer looks can include shorts or should stay with longer bottoms.">
        <SegmentedControl
          options={SUMMER_BOTTOM_OPTIONS}
          value={profile.summerBottomPreference}
          onChange={(value) => updateField('summerBottomPreference', value)}
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

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <PrimaryButton 
          disabled={disabled} 
          label={disabled ? 'Saving...' : submitLabel} 
          onPress={handleSubmit}
          variant="accent"
          size="large"
          icon="checkmark-circle"
          iconPosition="left"
        />
        <AppText variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
          Your profile is securely stored and used for personalized recommendations.
        </AppText>
      </View>
    </View>
  );
}

const inputStyle = {
  backgroundColor: theme.colors.background,
  borderColor: theme.colors.border,
  borderRadius: theme.radius.md,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 16,
  minHeight: 52,
  paddingHorizontal: spacing.md,
} as const;
