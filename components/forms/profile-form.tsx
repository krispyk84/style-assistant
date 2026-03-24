import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  TEMPERATURE_UNIT_OPTIONS,
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
type PickerFieldKey =
  | 'gender'
  | 'fitPreference'
  | 'stylePreference'
  | 'budget'
  | 'hairColor'
  | 'skinTone'
  | 'summerBottomPreference'
  | 'temperatureUnit';

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
  const [pickerField, setPickerField] = useState<PickerFieldKey | null>(null);

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

  const pickerConfigs = useMemo(
    () => ({
      gender: {
        label: 'Gender',
        options: GENDER_OPTIONS,
        value: profile.gender,
        onChange: (value: string) => updateField('gender', value as Profile['gender']),
      },
      fitPreference: {
        label: 'Fit preference',
        options: FIT_PREFERENCE_OPTIONS,
        value: profile.fitPreference,
        onChange: (value: string) => updateField('fitPreference', value as Profile['fitPreference']),
      },
      stylePreference: {
        label: 'Style preference',
        options: STYLE_PREFERENCE_OPTIONS,
        value: profile.stylePreference,
        onChange: (value: string) => updateField('stylePreference', value as Profile['stylePreference']),
      },
      budget: {
        label: 'Budget',
        options: BUDGET_OPTIONS,
        value: profile.budget,
        onChange: (value: string) => updateField('budget', value as Profile['budget']),
      },
      hairColor: {
        label: 'Hair color',
        options: HAIR_COLOR_OPTIONS,
        value: profile.hairColor,
        onChange: (value: string) => updateField('hairColor', value as Profile['hairColor']),
      },
      skinTone: {
        label: 'Skin tone',
        options: SKIN_TONE_OPTIONS,
        value: profile.skinTone,
        onChange: (value: string) => updateField('skinTone', value as Profile['skinTone']),
      },
      summerBottomPreference: {
        label: 'Warm weather bottoms',
        options: SUMMER_BOTTOM_OPTIONS,
        value: profile.summerBottomPreference,
        onChange: (value: string) => updateField('summerBottomPreference', value as Profile['summerBottomPreference']),
      },
      temperatureUnit: {
        label: 'Temperature unit',
        options: TEMPERATURE_UNIT_OPTIONS,
        value: profile.temperatureUnit,
        onChange: (value: string) => updateField('temperatureUnit', value as Profile['temperatureUnit']),
      },
    }),
    [profile]
  );

  return (
    <View style={{ gap: spacing.xl }}>
      <FormField label="First name" hint="Used to personalise your home screen greeting.">
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Your name"
          placeholderTextColor={theme.colors.subtleText}
          style={inputStyle}
          value={profile.name}
        />
      </FormField>

      <FormField label="Gender" hint="Used to tailor fit and style guidance.">
        <PickerField value={profile.gender} onPress={() => setPickerField('gender')} />
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
        <PickerField value={profile.fitPreference} onPress={() => setPickerField('fitPreference')} />
      </FormField>

      <FormField label="Style preference" hint="Pick the closest overall direction.">
        <PickerField value={profile.stylePreference} onPress={() => setPickerField('stylePreference')} />
      </FormField>

      <FormField label="Budget" hint="Helps future recommendations stay realistic.">
        <PickerField value={profile.budget} onPress={() => setPickerField('budget')} />
      </FormField>

      <FormField label="Hair color" hint="Useful for palette and contrast cues.">
        <PickerField value={profile.hairColor} onPress={() => setPickerField('hairColor')} />
      </FormField>

      <FormField label="Skin tone" hint="Used later for color guidance.">
        <PickerField value={profile.skinTone} onPress={() => setPickerField('skinTone')} />
      </FormField>

      <FormField label="Warm weather bottoms" hint="Choose whether summer looks can include shorts or should stay with longer bottoms.">
        <PickerField value={profile.summerBottomPreference} onPress={() => setPickerField('summerBottomPreference')} />
      </FormField>

      <FormField label="Temperature unit" hint="Use your preferred unit wherever temperatures appear in the app.">
        <PickerField value={profile.temperatureUnit} onPress={() => setPickerField('temperatureUnit')} />
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
        <AppText tone="muted">Your profile is saved to the Vesture backend and used for personalized guidance.</AppText>
      </View>

      <PickerModal
        visible={Boolean(pickerField)}
        title={pickerField ? pickerConfigs[pickerField].label : ''}
        options={pickerField ? pickerConfigs[pickerField].options : []}
        value={pickerField ? pickerConfigs[pickerField].value : ''}
        onClose={() => setPickerField(null)}
        onSelect={(value) => {
          if (!pickerField) {
            return;
          }

          pickerConfigs[pickerField].onChange(value);
          setPickerField(null);
        }}
      />
    </View>
  );
}

function PickerField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={pickerFieldStyle}>
      <AppText style={{ textTransform: 'capitalize' }}>{value.replaceAll('-', ' ')}</AppText>
      <Ionicons color={theme.colors.subtleText} name="chevron-down" size={18} />
    </Pressable>
  );
}

function PickerModal({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={modalOverlayStyle}>
        <Pressable onPress={(event) => event.stopPropagation()} style={modalCardStyle}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title">{title}</AppText>
            <AppText tone="muted">Choose the option that fits you best.</AppText>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.sm }}>
            {options.map((option) => {
              const isSelected = option === value;

              return (
                <Pressable
                  key={option}
                  onPress={() => onSelect(option)}
                  style={[
                    pickerOptionStyle,
                    { borderColor: isSelected ? theme.colors.accent : theme.colors.border },
                  ]}>
                  <AppText style={{ textTransform: 'capitalize' }}>{option.replaceAll('-', ' ')}</AppText>
                  {isSelected ? <Ionicons color={theme.colors.accent} name="checkmark-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} style={pickerOptionStyle}>
            <AppText>Cancel</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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

const pickerFieldStyle = {
  alignItems: 'center',
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
  minHeight: 54,
  paddingHorizontal: spacing.md,
} as const;

const modalOverlayStyle = {
  alignItems: 'center',
  backgroundColor: 'rgba(24, 20, 16, 0.25)',
  flex: 1,
  justifyContent: 'center',
  padding: spacing.lg,
} as const;

const modalCardStyle = {
  backgroundColor: theme.colors.background,
  borderColor: theme.colors.border,
  borderRadius: 24,
  borderWidth: 1,
  gap: spacing.lg,
  maxWidth: 420,
  padding: spacing.lg,
  width: '100%',
} as const;

const pickerOptionStyle = {
  alignItems: 'center',
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
  minHeight: 52,
  paddingHorizontal: spacing.md,
} as const;
