import { TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { ONBOARDING_INPUT_STYLE } from './onboarding-assets';
import type { useOnboardingForms } from './useOnboardingForms';

type Props = {
  formsHook: ReturnType<typeof useOnboardingForms>;
  isSaving: boolean;
  onComplete: () => void;
};

export function OnboardingStepNotes({ formsHook, isSaving, onComplete }: Props) {
  return (
    <View style={{ gap: spacing.lg }}>
      <TextInput
        multiline
        numberOfLines={5}
        onChangeText={(v) => formsHook.setField('notes', v)}
        placeholder="e.g. I work in finance, live in a cold climate, and prefer understated style."
        placeholderTextColor={theme.colors.subtleText}
        style={[ONBOARDING_INPUT_STYLE, { minHeight: 140, paddingTop: spacing.md, textAlignVertical: 'top' }]}
        value={formsHook.profile.notes}
      />
      <PrimaryButton
        label={isSaving ? 'Saving...' : 'Complete setup'}
        disabled={isSaving}
        onPress={onComplete}
      />
    </View>
  );
}
