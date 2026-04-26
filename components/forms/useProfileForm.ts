import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';

import { defaultProfile } from '@/lib/default-profile';
import type { Profile, ProfileValidationErrors } from '@/types/profile';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FEMALE_BODY_TYPE_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  FIT_TENDENCY_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
  WEIGHT_DISTRIBUTION_OPTIONS,
} from '@/types/profile';
import {
  centimetersToFeetInches,
  feetInchesToCentimeters,
  initialWeightValue,
  kilogramsToPounds,
  normalizeProfile,
  poundsToKilograms,
  type HeightUnit,
  type WeightUnit,
} from './profile-form-mappers';

// ── Picker field keys ──────────────────────────────────────────────────────────

export type PickerFieldKey =
  | 'bodyType'
  | 'weightDistribution'
  | 'fitTendency'
  | 'fitPreference'
  | 'stylePreference'
  | 'budget'
  | 'hairColor'
  | 'skinTone';

export type PickerConfig = {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  /** Optional display labels mapping raw option values to human-readable strings. */
  displayLabels?: Record<string, string>;
};

const FIT_TENDENCY_DISPLAY_LABELS: Record<string, string> = {
  fits_well: 'Fits well throughout',
  tight_chest_loose_below: 'Tight in chest / shoulders, loose through midsection',
  loose_chest_tight_below: 'Loose in chest, tight at belly / waist',
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useProfileForm(initialValue: Profile = defaultProfile) {
  const [profile, setProfile] = useState(() => normalizeProfile(initialValue));
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weightValue, setWeightValue] = useState(() => initialWeightValue(initialValue.weightKg));
  const [errors, setErrors] = useState<ProfileValidationErrors>({});
  const [pickerField, setPickerField] = useState<PickerFieldKey | null>(null);

  // Reset all form state when the authoritative initialValue changes (e.g. profile
  // reloaded from server).
  useEffect(() => {
    setProfile(normalizeProfile(initialValue));
    setHeightUnit('cm');
    setHeightFeet('');
    setHeightInches('');
    setWeightUnit('kg');
    setWeightValue(initialWeightValue(initialValue.weightKg));
  }, [initialValue]);

  function updateField<K extends keyof Profile>(key: K, value: Profile[K]) {
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
    if (nextUnit !== 'kg' && nextUnit !== 'lbs') return;
    if (nextUnit === weightUnit) return;

    setWeightValue((current) => {
      if (!current) return current;
      return nextUnit === 'lbs' ? kilogramsToPounds(current) : poundsToKilograms(current);
    });
    setWeightUnit(nextUnit);
    setErrors((current) => {
      const next = { ...current };
      delete next.weightKg;
      return next;
    });
  }

  const pickerConfigs: Record<PickerFieldKey, PickerConfig> = useMemo(
    () => ({
      bodyType: {
        label: 'Body type',
        options: profile.gender === 'woman' ? FEMALE_BODY_TYPE_OPTIONS : BODY_TYPE_OPTIONS,
        value: profile.bodyType ?? '',
        onChange: (value) => updateField('bodyType', value as Profile['bodyType']),
      },
      weightDistribution: {
        label: 'Weight distribution',
        options: WEIGHT_DISTRIBUTION_OPTIONS,
        value: profile.weightDistribution ?? '',
        onChange: (value) => updateField('weightDistribution', value as Profile['weightDistribution']),
      },
      fitTendency: {
        label: 'How clothes typically fit',
        options: FIT_TENDENCY_OPTIONS,
        value: profile.fitTendency ?? '',
        onChange: (value) => updateField('fitTendency', value as Profile['fitTendency']),
        displayLabels: FIT_TENDENCY_DISPLAY_LABELS,
      },
      fitPreference: {
        label: 'Fit preference',
        options: FIT_PREFERENCE_OPTIONS,
        value: profile.fitPreference,
        onChange: (value) => updateField('fitPreference', value as Profile['fitPreference']),
      },
      stylePreference: {
        label: 'Style preference',
        options: STYLE_PREFERENCE_OPTIONS,
        value: profile.stylePreference,
        onChange: (value) => updateField('stylePreference', value as Profile['stylePreference']),
      },
      budget: {
        label: 'Budget',
        options: BUDGET_OPTIONS,
        value: profile.budget,
        onChange: (value) => updateField('budget', value as Profile['budget']),
      },
      hairColor: {
        label: 'Hair color',
        options: HAIR_COLOR_OPTIONS,
        value: profile.hairColor,
        onChange: (value) => updateField('hairColor', value as Profile['hairColor']),
      },
      skinTone: {
        label: 'Skin tone',
        options: SKIN_TONE_OPTIONS,
        value: profile.skinTone,
        onChange: (value) => updateField('skinTone', value as Profile['skinTone']),
      },
    }),
    [profile],
  );

  return {
    profile,
    heightUnit,
    heightFeet,
    setHeightFeet,
    heightInches,
    setHeightInches,
    weightUnit,
    weightValue,
    setWeightValue,
    errors,
    setErrors: setErrors as Dispatch<SetStateAction<ProfileValidationErrors>>,
    pickerField,
    setPickerField,
    updateField,
    handleHeightUnitChange,
    handleWeightUnitChange,
    pickerConfigs,
  };
}
