import { Href } from 'expo-router';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';

type PromptComposerProps = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: Href;
};

const mockFields = [
  'Occasion: Client dinner in early evening',
  'Desired tone: Relaxed, polished, masculine',
  'Budget tier: Refined',
];

export function PromptComposer({ title, description, ctaLabel, ctaHref }: PromptComposerProps) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        padding: spacing.lg,
        gap: spacing.lg,
      }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="sectionTitle">{title}</AppText>
        <AppText tone="muted">{description}</AppText>
      </View>
      <View style={{ gap: spacing.sm }}>
        {mockFields.map((field) => (
          <View
            key={field}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 20,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}>
            <AppText>{field}</AppText>
          </View>
        ))}
      </View>
      <PrimaryButton href={ctaHref} label={ctaLabel} />
    </View>
  );
}
