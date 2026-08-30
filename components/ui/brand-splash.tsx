import { Image, View } from 'react-native';
import { useEffect, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type BrandSplashProps = {
  subtitle?: string;
  messages?: string[];
  /** Hides this instance's own logo — used once the root layout's shrink-transition overlay logo has taken over, so there's no doubled logo. */
  hideLogo?: boolean;
};

export function BrandSplash({ subtitle, messages, hideLogo }: BrandSplashProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeSubtitle = messages?.length ? messages[Math.min(messageIndex, messages.length - 1)] : subtitle;

  useEffect(() => {
    if (!messages?.length || messages.length === 1) {
      return;
    }

    const timeout = setInterval(() => {
      setMessageIndex((current) => (current < messages.length - 1 ? current + 1 : current));
    }, 2200);

    return () => clearInterval(timeout);
  }, [messages]);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}>
      {/* Logo centered on its own — text is out of flow so it cannot shift the logo. */}
      <View style={{ height: 220, maxWidth: 220, opacity: hideLogo ? 0 : 1, width: '100%' }}>
        <Image
          source={require('../../logo.png')}
          style={{
            height: '100%',
            resizeMode: 'contain',
            width: '100%',
          }}
        />
      </View>
      {activeSubtitle ? (
        <View
          style={{
            alignItems: 'center',
            bottom: spacing.xl * 2,
            left: spacing.xl,
            position: 'absolute',
            right: spacing.xl,
          }}>
          <AppText tone="muted" style={{ maxWidth: 260, textAlign: 'center' }}>
            {activeSubtitle}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
