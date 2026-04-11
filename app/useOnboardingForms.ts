import { useState } from 'react';

import { useToast } from '@/components/ui/toast-provider';
import type { Profile } from '@/types/profile';
import {
  EMPTY_WIZARD_PROFILE,
  resolvedHeightCm,
  resolvedWeightKg,
  type HeightUnit,
  type WeightUnit,
  type WizardProfile,
} from './onboarding-mappers';

export function useOnboardingForms() {
  const { showToast } = useToast();

  const [profile, setProfile] = useState<WizardProfile>(EMPTY_WIZARD_PROFILE);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('ft');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');

  function setField<K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  // Gender is the one field that also has a typed setter used by handleGenderSelect
  function setGender(gender: Profile['gender']) {
    setProfile((p) => ({ ...p, gender }));
  }

  function validateName(): boolean {
    if (!profile.name.trim()) {
      showToast('Please enter your name to continue.', 'error');
      return false;
    }
    return true;
  }

  function validateMeasurements(): boolean {
    const hCm = resolvedHeightCm(profile, heightUnit, heightFeet, heightInches);
    const wKg = resolvedWeightKg(profile, weightUnit);
    if (!hCm || parseFloat(hCm) <= 0) {
      showToast('Please enter your height to continue.', 'error');
      return false;
    }
    if (!wKg || parseFloat(wKg) <= 0) {
      showToast('Please enter your weight to continue.', 'error');
      return false;
    }
    return true;
  }

  return {
    profile,
    weightUnit,
    setWeightUnit,
    heightUnit,
    setHeightUnit,
    heightFeet,
    setHeightFeet,
    heightInches,
    setHeightInches,
    setField,
    setGender,
    validateName,
    validateMeasurements,
  };
}
