import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type FloatingBackButtonProps = {
  onPress?: () => void;
};

// Matches AppScreen's floatingBack pill styling — pulled out as its own
// component for screens that own their own ScrollView (with a custom
// contentContainerStyle and/or a fixed bottom bar) rather than going through
// AppScreen, so they can track scroll offset themselves and still get the
// same "persists once you scroll past the inline header" affordance.
export function FloatingBackButton({ onPress }: FloatingBackButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 999,
        borderWidth: 1,
        elevation: 4,
        flexDirection: 'row',
        gap: spacing.xs,
        left: spacing.lg,
        top: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      }}>
      <AppIcon color={theme.colors.text} name="arrow-left" size={16} />
      <AppText style={{ fontSize: 14 }}>Back</AppText>
    </Pressable>
  );
}
