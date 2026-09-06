import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
//
// A position:'absolute' child is positioned relative to its parent's border
// box, NOT the padding SafeAreaView adds for the notch/status bar — so this
// needs its own insets.top on top of spacing.md, same as AppScreen's own
// floatingBack pill does, or it renders under the status bar.
export function FloatingBackButton({ onPress }: FloatingBackButtonProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

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
        top: insets.top + spacing.md,
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
