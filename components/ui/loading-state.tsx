import { ActivityIndicator, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
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
      <ActivityIndicator color={theme.colors.text} />
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </View>
  );
}
