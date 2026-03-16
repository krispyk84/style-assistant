import { Image, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type BrandSplashProps = {
  subtitle?: string;
};

export function BrandSplash({ subtitle }: BrandSplashProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}>
      <View
        style={{
          alignItems: 'center',
          gap: spacing.lg,
          width: '100%',
        }}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={{
            height: 360,
            maxWidth: 280,
            resizeMode: 'contain',
            width: '100%',
          }}
        />
        {subtitle ? (
          <AppText tone="muted" style={{ maxWidth: 260, textAlign: 'center' }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
