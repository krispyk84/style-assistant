import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { BrandSplash } from '@/components/ui/brand-splash';
import { SelectorGrid } from '@/components/ui/selector-grid';
import { spacing, theme } from '@/constants/theme';
import { trackOnboardingStarted } from '@/lib/analytics';
import type { Profile } from '@/types/profile';
import { ONBOARDING_STEP_HINTS, ONBOARDING_STEP_TITLES } from './onboarding-assets';
import {
  HAIR_OPTIONS,
  SKIN_OPTIONS,
  SUMMER_OPTIONS,
  TEMP_OPTIONS,
  WEIGHT_DIST_OPTIONS,
  buildBodyTypeOptions,
  buildBudgetOptions,
  buildFitOptions,
  buildStyleOptions,
} from './onboarding-step-options';
import type { WizardProfile } from './onboarding-mappers';
import { OnboardingStepGender } from './OnboardingStepGender';
import { OnboardingStepMeasurements } from './OnboardingStepMeasurements';
import { OnboardingStepName } from './OnboardingStepName';
import { OnboardingStepNotes } from './OnboardingStepNotes';
import { useOnboardingFlow } from './useOnboardingFlow';
import { useOnboardingForms } from './useOnboardingForms';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const formsHook = useOnboardingForms();
  const flowHook = useOnboardingFlow({
    profile: formsHook.profile,
    heightUnit: formsHook.heightUnit,
    weightUnit: formsHook.weightUnit,
    heightFeet: formsHook.heightFeet,
    heightInches: formsHook.heightInches,
  });

  useEffect(() => {
    trackOnboardingStarted();
  }, []);

  // Scroll to top whenever the step changes (covers advance, goBack, and the
  // safety-net redirect inside handleComplete)
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [flowHook.stepIndex]);

  if (!flowHook.isHydrated) {
    return (
      <BrandSplash
        messages={[
          'Preparing your Vesture onboarding.',
          'Loading your profile details.',
          'Getting your style setup ready.',
        ]}
      />
    );
  }

  if (flowHook.hasCompletedOnboarding) {
    return <Redirect href="/(app)/home" />;
  }

  // ── Coordinators ─────────────────────────────────────────────────────────────

  function selectAndAdvance<K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) {
    formsHook.setField(key, value);
    setTimeout(flowHook.advance, 160);
  }

  function handleGenderSelect(gender: Profile['gender']) {
    formsHook.setGender(gender);
    setTimeout(flowHook.advance, 160);
  }

  // ── Step content ──────────────────────────────────────────────────────────────

  function renderStep() {
    const { profile } = formsHook;

    switch (flowHook.step) {
      case 'name':
        return <OnboardingStepName formsHook={formsHook} onAdvance={flowHook.advance} />;

      case 'gender':
        return <OnboardingStepGender selected={profile.gender} onSelect={handleGenderSelect} />;

      case 'measurements':
        return <OnboardingStepMeasurements formsHook={formsHook} onAdvance={flowHook.advance} />;

      case 'fit':
        return (
          <SelectorGrid
            options={buildFitOptions(profile.gender)}
            value={profile.fitPreference ?? null}
            onChange={(v) => selectAndAdvance('fitPreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'style':
        return (
          <SelectorGrid
            options={buildStyleOptions(profile.gender)}
            value={profile.stylePreference ?? null}
            onChange={(v) => selectAndAdvance('stylePreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'budget':
        return (
          <SelectorGrid
            options={buildBudgetOptions(profile.gender)}
            value={profile.budget ?? null}
            onChange={(v) => selectAndAdvance('budget', v)}
            thumbnailHeight={220}
          />
        );

      case 'hair':
        return (
          <SelectorGrid
            options={HAIR_OPTIONS}
            value={profile.hairColor ?? null}
            onChange={(v) => selectAndAdvance('hairColor', v)}
            thumbnailHeight={90}
          />
        );

      case 'skin':
        return (
          <SelectorGrid
            options={SKIN_OPTIONS}
            value={profile.skinTone ?? null}
            onChange={(v) => selectAndAdvance('skinTone', v)}
            thumbnailHeight={90}
          />
        );

      case 'bottoms':
        return (
          <SelectorGrid
            options={SUMMER_OPTIONS}
            value={profile.summerBottomPreference ?? null}
            onChange={(v) => selectAndAdvance('summerBottomPreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'body-type':
        return (
          <SelectorGrid
            options={buildBodyTypeOptions(profile.gender)}
            value={profile.bodyType ?? null}
            onChange={(v) => selectAndAdvance('bodyType', v)}
            thumbnailHeight={220}
          />
        );

      case 'weight-distribution':
        return (
          <SelectorGrid
            options={WEIGHT_DIST_OPTIONS}
            value={profile.weightDistribution ?? null}
            onChange={(v) => selectAndAdvance('weightDistribution', v)}
            thumbnailHeight={220}
          />
        );

      case 'temperature':
        return (
          <SelectorGrid
            options={TEMP_OPTIONS}
            value={profile.temperatureUnit ?? null}
            onChange={(v) => selectAndAdvance('temperatureUnit', v)}
            thumbnailHeight={120}
          />
        );

      case 'notes':
        return (
          <OnboardingStepNotes
            formsHook={formsHook}
            isSaving={flowHook.isSaving}
            onComplete={() => void flowHook.handleComplete()}
          />
        );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header: back + progress */}
      <View
        style={{
          paddingTop: insets.top + spacing.xs,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={flowHook.goBack} hitSlop={12}>
            <AppIcon name="chevron-left" size={24} color={theme.colors.text} />
          </Pressable>
          <AppText tone="subtle" style={{ fontSize: 12 }}>
            {flowHook.stepIndex + 1} / {flowHook.totalSteps}
          </AppText>
        </View>

        {/* Progress bar */}
        <View style={{ backgroundColor: theme.colors.border, borderRadius: 99, height: 2 }}>
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: 99,
              height: 2,
              width: `${((flowHook.stepIndex + 1) / flowHook.totalSteps) * 100}%`,
            }}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl + insets.bottom }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.xl }}>
          {/* Question */}
          <View style={{ gap: spacing.xs }}>
            <AppText variant="hero" style={{ lineHeight: 44 }}>
              {ONBOARDING_STEP_TITLES[flowHook.step]}
            </AppText>
            {ONBOARDING_STEP_HINTS[flowHook.step] ? (
              <AppText tone="muted">{ONBOARDING_STEP_HINTS[flowHook.step]}</AppText>
            ) : null}
          </View>

          {/* Step content */}
          {renderStep()}
        </View>
      </ScrollView>
    </View>
  );
}

export { OnboardingScreen as default };
