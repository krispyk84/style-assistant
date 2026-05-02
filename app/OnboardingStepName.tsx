import { TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { ONBOARDING_INPUT_STYLE } from './onboarding-assets';
import type { useOnboardingForms } from './useOnboardingForms';

type Props = {
  formsHook: ReturnType<typeof useOnboardingForms>;
  onAdvance: () => void;
};

export function OnboardingStepName({ formsHook, onAdvance }: Props) {
  function submit() {
    if (formsHook.validateName()) onAdvance();
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <TextInput
        autoCapitalize="words"
        autoComplete="given-name"
        autoCorrect={false}
        autoFocus
        textContentType="givenName"
        onChangeText={(v) => formsHook.setField('name', v)}
        placeholder="Your first name"
        placeholderTextColor={theme.colors.subtleText}
        returnKeyType="next"
        onSubmitEditing={submit}
        style={ONBOARDING_INPUT_STYLE}
        value={formsHook.profile.name}
      />
      <PrimaryButton label="Continue" onPress={submit} />
    </View>
  );
}
