import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { spacing, theme } from '@/constants/theme';
import { ONBOARDING_INPUT_STYLE } from './onboarding-assets';
import type { useOnboardingForms } from './useOnboardingForms';

type Props = {
  formsHook: ReturnType<typeof useOnboardingForms>;
  onAdvance: () => void;
};

export function OnboardingStepMeasurements({ formsHook, onAdvance }: Props) {
  const { profile, heightUnit, weightUnit, heightFeet, heightInches } = formsHook;

  function submit() {
    if (formsHook.validateMeasurements()) onAdvance();
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Height</AppText>
        <SegmentedControl
          options={['cm', 'ft']}
          value={heightUnit}
          onChange={(v) => formsHook.setHeightUnit(v as 'cm' | 'ft')}
        />
        {heightUnit === 'cm' ? (
          <TextInput
            keyboardType="number-pad"
            onChangeText={(v) => formsHook.setField('heightCm', v.replace(/[^0-9]/g, ''))}
            placeholder="183"
            placeholderTextColor={theme.colors.subtleText}
            style={ONBOARDING_INPUT_STYLE}
            value={profile.heightCm}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(v) => formsHook.setHeightFeet(v.replace(/[^0-9]/g, ''))}
                placeholder="5"
                placeholderTextColor={theme.colors.subtleText}
                style={ONBOARDING_INPUT_STYLE}
                value={heightFeet}
              />
              <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>feet</AppText>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(v) => formsHook.setHeightInches(v.replace(/[^0-9.]/g, ''))}
                placeholder="10"
                placeholderTextColor={theme.colors.subtleText}
                style={ONBOARDING_INPUT_STYLE}
                value={heightInches}
              />
              <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>inches</AppText>
            </View>
          </View>
        )}
      </View>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Weight</AppText>
        <SegmentedControl
          options={['kg', 'lbs']}
          value={weightUnit}
          onChange={(v) => formsHook.setWeightUnit(v as 'kg' | 'lbs')}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(v) => formsHook.setField('weightKg', v.replace(/[^0-9.]/g, ''))}
          placeholder={weightUnit === 'kg' ? '79' : '160'}
          placeholderTextColor={theme.colors.subtleText}
          style={ONBOARDING_INPUT_STYLE}
          value={profile.weightKg}
        />
      </View>
      <PrimaryButton label="Continue" onPress={submit} />
    </View>
  );
}
