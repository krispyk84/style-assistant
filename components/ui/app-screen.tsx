import { PropsWithChildren } from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, theme } from '@/constants/theme';

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  topInset?: boolean;
  noPadding?: boolean;
}>;

export function AppScreen({ children, scrollable = false, topInset = true, noPadding = false }: AppScreenProps) {
  const content = (
    <View
      style={{
        flex: 1,
        paddingHorizontal: noPadding ? 0 : spacing.lg,
        paddingTop: topInset ? spacing.lg : spacing.sm,
        paddingBottom: spacing.xxl,
      }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      {scrollable ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.lg }}
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
