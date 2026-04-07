import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
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
type HeightUnit = 'cm' | 'ft';
type PickerFieldKey =
  | 'fitPreference'
  | 'stylePreference'
  | 'budget'
  | 'hairColor'
  | 'skinTone';

function normalizeProfile(p: Profile): Profile {
  const g = p.gender as string;
  const heightN = parseFloat(p.heightCm);
  return {
    ...p,
    gender: g === 'prefer-not-to-say' ? 'non-binary' : p.gender,
    heightCm: Number.isFinite(heightN) && heightN > 0 ? String(Math.round(heightN)) : p.heightCm,
  };
}

function roundMeasurementStr(s: string): string {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : s;
}

function centimetersToFeetInches(cm: string): { feet: string; inches: string } {
  const numeric = Number(cm);
  if (!Number.isFinite(numeric) || numeric <= 0) return { feet: '', inches: '' };
  const totalInches = numeric / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet: String(feet), inches: String(inches) };
}

function feetInchesToCentimeters(feet: string, inches: string): string {
  const f = parseFloat(feet) || 0;
  const i = parseFloat(inches) || 0;
  const totalInches = f * 12 + i;
  return totalInches > 0 ? Math.round(totalInches * 2.54).toString() : '';
}

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
  const { theme } = useTheme();
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
  const [profile, setProfile] = useState(() => normalizeProfile(initialValue));
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weightValue, setWeightValue] = useState(() => roundMeasurementStr(initialValue.weightKg));
  const [errors, setErrors] = useState<ProfileValidationErrors>({});
  const [pickerField, setPickerField] = useState<PickerFieldKey | null>(null);

  useEffect(() => {
    setProfile(normalizeProfile(initialValue));
    setHeightUnit('cm');
    setHeightFeet('');
    setHeightInches('');
    setWeightUnit('kg');
    setWeightValue(roundMeasurementStr(initialValue.weightKg));
  }, [initialValue]);

  async function handleSubmit() {
    const normalizedProfile = {
      ...profile,
      heightCm: heightUnit === 'ft' ? feetInchesToCentimeters(heightFeet, heightInches) : profile.heightCm,
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

  function handleHeightUnitChange(nextUnit: string) {
    if (nextUnit !== 'cm' && nextUnit !== 'ft') return;
    if (nextUnit === heightUnit) return;

    if (nextUnit === 'ft') {
      const { feet, inches } = centimetersToFeetInches(profile.heightCm);
      setHeightFeet(feet);
      setHeightInches(inches);
    } else {
      updateField('heightCm', feetInchesToCentimeters(heightFeet, heightInches));
    }

    setHeightUnit(nextUnit);
    setErrors((current) => {
      const next = { ...current };
      delete next.heightCm;
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
        <SegmentedControl
          options={GENDER_OPTIONS}
          value={profile.gender}
          onChange={(value) => updateField('gender', value)}
        />
      </FormField>

      <FormField label="Height" hint="Switch between centimetres and feet anytime." error={errors.heightCm as string | undefined}>
        <View style={{ gap: spacing.md }}>
          <SegmentedControl options={['cm', 'ft']} value={heightUnit} onChange={handleHeightUnitChange} />
          {heightUnit === 'cm' ? (
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => updateField('heightCm', value.replace(/[^0-9]/g, ''))}
              placeholder="183"
              placeholderTextColor={theme.colors.subtleText}
              style={inputStyle}
              value={profile.heightCm}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(v) => setHeightFeet(v.replace(/[^0-9]/g, ''))}
                  placeholder="5"
                  placeholderTextColor={theme.colors.subtleText}
                  style={inputStyle}
                  value={heightFeet}
                />
                <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>feet</AppText>
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(v) => setHeightInches(v.replace(/[^0-9.]/g, ''))}
                  placeholder="10"
                  placeholderTextColor={theme.colors.subtleText}
                  style={inputStyle}
                  value={heightInches}
                />
                <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>inches</AppText>
              </View>
            </View>
          )}
        </View>
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
        <SegmentedControl
          options={SUMMER_BOTTOM_OPTIONS}
          value={profile.summerBottomPreference}
          onChange={(value) => updateField('summerBottomPreference', value)}
        />
      </FormField>

      <FormField label="Temperature unit" hint="Use your preferred unit wherever temperatures appear in the app.">
        <SegmentedControl
          options={TEMPERATURE_UNIT_OPTIONS}
          value={profile.temperatureUnit}
          onChange={(value) => updateField('temperatureUnit', value)}
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
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 54,
        paddingHorizontal: spacing.md,
      }}>
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
  const { theme } = useTheme();
  const optionStyle = {
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
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.overlay,
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            gap: spacing.lg,
            maxWidth: 420,
            padding: spacing.lg,
            width: '100%',
          }}>
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
                    optionStyle,
                    { borderColor: isSelected ? theme.colors.accent : theme.colors.border },
                  ]}>
                  <AppText style={{ textTransform: 'capitalize' }}>{option.replaceAll('-', ' ')}</AppText>
                  {isSelected ? <Ionicons color={theme.colors.accent} name="checkmark-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} style={optionStyle}>
            <AppText>Cancel</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

