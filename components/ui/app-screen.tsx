import { type PropsWithChildren, type RefObject } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, theme } from '@/constants/theme';

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  topInset?: boolean;
  /** Optional ref forwarded to the inner ScrollView (only meaningful when scrollable=true). */
  scrollRef?: RefObject<ScrollView>;
}>;

export function AppScreen({ children, scrollable = false, topInset = true, scrollRef }: AppScreenProps) {
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
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
