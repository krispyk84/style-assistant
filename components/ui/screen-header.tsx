import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  /** Override the default router.back() — e.g. to step back one stage within a multi-stage flow. */
  onBack?: () => void;
};

export function ScreenHeader({ title, showBack = false, onBack }: ScreenHeaderProps) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
      {showBack ? (
        <Pressable hitSlop={8} onPress={onBack ?? (() => router.back())}>
          <AppIcon color={theme.colors.text} name="chevron-left" size={24} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
      <AppText variant="eyebrow" style={{ letterSpacing: 2 }}>{title}</AppText>
      <View style={{ width: 24 }} />
    </View>
  );
}
