import { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, theme } from '@/constants/theme';

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
}>;

export function AppScreen({ children, scrollable = false }: AppScreenProps) {
  const content = (
    <View
      style={{
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
      }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {scrollable ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
