import { router } from 'expo-router';
import { useCallback, type PropsWithChildren, type RefObject, useState } from 'react';
import { Pressable, ScrollView, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  topInset?: boolean;
  /** When true, shows a floating "Back" button after the user scrolls down. */
  floatingBack?: boolean;
  /** Optional ref forwarded to the inner ScrollView (only meaningful when scrollable=true). */
  scrollRef?: RefObject<ScrollView>;
  /** Optional scroll handler forwarded to the inner ScrollView. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}>;

const FLOATING_BACK_THRESHOLD = 80;

export function AppScreen({ children, scrollable = false, topInset = true, floatingBack = false, scrollRef, onScroll }: AppScreenProps) {
  const [showFloatingBack, setShowFloatingBack] = useState(false);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (floatingBack) {
        setShowFloatingBack(e.nativeEvent.contentOffset.y > FLOATING_BACK_THRESHOLD);
      }
      onScroll?.(e);
    },
    [floatingBack, onScroll],
  );

  const content = (
    <View
      style={{
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: topInset ? spacing.md : spacing.xs,
        paddingBottom: spacing.xl,
      }}>
      {children}
    </View>
  );

  const scrollProps = floatingBack || onScroll
    ? { onScroll: handleScroll, scrollEventThrottle: 16 }
    : {};

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}>
      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}>
          {content}
        </ScrollView>
      ) : (
        content
      )}

      {floatingBack && showFloatingBack ? (
        <Pressable
          onPress={() => router.back()}
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
      ) : null}
    </SafeAreaView>
  );
}
