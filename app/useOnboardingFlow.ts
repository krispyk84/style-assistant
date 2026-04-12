import { useState } from 'react';
import { router } from 'expo-router';

import { useToast } from '@/components/ui/toast-provider';
import { useAppSession } from '@/hooks/use-app-session';
import { trackOnboardingCompleted } from '@/lib/analytics';
import {
  buildProfile,
  resolvedHeightCm,
  resolvedWeightKg,
  STEPS,
  type HeightUnit,
  type WeightUnit,
  type WizardProfile,
} from './onboarding-mappers';

type UseOnboardingFlowParams = {
  profile: WizardProfile;
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;
  heightFeet: string;
  heightInches: string;
};

export function useOnboardingFlow({
  profile,
  heightUnit,
  weightUnit,
  heightFeet,
  heightInches,
}: UseOnboardingFlowParams) {
  const { isHydrated, isSaving, saveProfile, hasCompletedOnboarding } = useAppSession();
  const { showToast } = useToast();

  const [stepIndex, setStepIndex] = useState(0);

  const MEN_ONLY_STEPS = ['bottoms', 'body-type', 'fit-tendency'] as const;
  const steps = profile.gender === 'man' ? STEPS : STEPS.filter((s) => !(MEN_ONLY_STEPS as readonly string[]).includes(s));
  const totalSteps = steps.length;
  const step = steps[stepIndex]!;

  function advance() {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      router.back();
    }
  }

  async function handleComplete() {
    const heightCm = resolvedHeightCm(profile, heightUnit, heightFeet, heightInches);
    const weightKg = resolvedWeightKg(profile, weightUnit);

    if (!heightCm || parseFloat(heightCm) <= 0) {
      setStepIndex(steps.indexOf('measurements'));
      showToast('Please enter your height to continue.', 'error');
      return;
    }
    if (!weightKg || parseFloat(weightKg) <= 0) {
      setStepIndex(steps.indexOf('measurements'));
      showToast('Please enter your weight to continue.', 'error');
      return;
    }

    const finalProfile = buildProfile(profile, heightUnit, weightUnit, heightFeet, heightInches);
    const saved = await saveProfile(finalProfile, true);

    if (saved) {
      trackOnboardingCompleted();
      router.replace('/(app)/home');
    } else {
      showToast('Profile could not be saved. Please try again.', 'error');
    }
  }

  return {
    stepIndex,
    step,
    steps,
    totalSteps,
    advance,
    goBack,
    handleComplete,
    isSaving,
    isHydrated,
    hasCompletedOnboarding,
  };
}
