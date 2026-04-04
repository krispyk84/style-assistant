import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, type PropsWithChildren, type RefObject, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  topInset?: boolean;
  /** When true, shows a floating "Back" button after the user scrolls down. */
  floatingBack?: boolean;
  /** Optional ref forwarded to the inner ScrollView (only meaningful when scrollable=true). */
  scrollRef?: RefObject<ScrollView>;
}>;

const FLOATING_BACK_THRESHOLD = 80;

export function AppScreen({ children, scrollable = false, topInset = true, floatingBack = false, scrollRef }: AppScreenProps) {
  const [showFloatingBack, setShowFloatingBack] = useState(false);
  const insets = useSafeAreaInsets();

  // Stable reference — prevents ScrollView from seeing a new onScroll prop on every render,
  // which in Fabric can cause repeated scroll-event registration.
  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      setShowFloatingBack(e.nativeEvent.contentOffset.y > FLOATING_BACK_THRESHOLD);
    },
    [],
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

  // Only spread scroll-tracking props when floatingBack is active.
  // Passing onScroll={undefined} / scrollEventThrottle={undefined} to a Fabric ScrollView
  // can register an event channel even with no handler, so we omit them entirely instead.
  const floatingScrollProps = floatingBack
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
          {...floatingScrollProps}>
          {content}
        </ScrollView>
      ) : (
        content
      )}

      {/* Floating back button — appears after scrolling down on screens without bottom nav */}
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
          <Ionicons color={theme.colors.text} name="arrow-back" size={16} />
          <AppText style={{ fontSize: 14 }}>Back</AppText>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
