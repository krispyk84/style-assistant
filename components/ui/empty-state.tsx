import { Href } from 'expo-router';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: Href;
};

export function EmptyState({ title, message, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        padding: spacing.xl,
        gap: spacing.md,
      }}>
      <AppText variant="title">{title}</AppText>
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {actionLabel && actionHref ? <PrimaryButton href={actionHref} label={actionLabel} /> : null}
    </View>
  );
}
