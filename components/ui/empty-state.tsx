import { Ionicons } from '@expo/vector-icons';
import { Href } from 'expo-router';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  actionHref?: Href;
};

export function EmptyState({ title, message, icon = 'folder-open-outline', actionLabel, actionHref }: EmptyStateProps) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: spacing.xxl,
          gap: spacing.md,
        },
        theme.shadows.sm,
      ]}>
      <View 
        style={{ 
          width: 64, 
          height: 64, 
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}>
        <Ionicons name={icon} size={28} color={theme.colors.accent} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText variant="caption" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
        {message}
      </AppText>
      {actionLabel && actionHref && (
        <PrimaryButton 
          href={actionHref} 
          label={actionLabel} 
          variant="accent"
          icon="arrow-forward"
          style={{ marginTop: spacing.sm }}
        />
      )}
    </View>
  );
}
