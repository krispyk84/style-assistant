import { Image, View, type LayoutChangeEvent, type View as RNView } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import type { LogoRect } from '@/lib/home-logo-position';

type BrandSplashProps = {
  subtitle?: string;
  messages?: string[];
  /** Reports the logo's rendered window position/size once laid out — used by the root layout's splash-to-Home shrink transition. */
  onLogoLayout?: (rect: LogoRect) => void;
  /** Hides this instance's own logo — used once the shrink-transition overlay logo has taken over, so there's no doubled logo. */
  hideLogo?: boolean;
};

export function BrandSplash({ subtitle, messages, onLogoLayout, hideLogo }: BrandSplashProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeSubtitle = messages?.length ? messages[Math.min(messageIndex, messages.length - 1)] : subtitle;
  const logoWrapRef = useRef<RNView>(null);

  useEffect(() => {
    if (!messages?.length || messages.length === 1) {
      return;
    }

    const timeout = setInterval(() => {
      setMessageIndex((current) => (current < messages.length - 1 ? current + 1 : current));
    }, 2200);

    return () => clearInterval(timeout);
  }, [messages]);

  function handleLogoLayout(_event: LayoutChangeEvent) {
    if (!onLogoLayout) return;
    logoWrapRef.current?.measureInWindow((x, y, width, height) => {
      onLogoLayout({ x, y, width, height });
    });
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}>
      {/* Logo centered on its own — text is out of flow so it cannot shift the logo.
          The wrapper (not the Image) carries the deterministic box size, since
          that's what gets measured for the splash-to-Home shrink transition —
          the Image itself just fills it. */}
      <View ref={logoWrapRef} onLayout={handleLogoLayout} style={{ height: 220, maxWidth: 220, opacity: hideLogo ? 0 : 1, width: '100%' }}>
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
