import { PropsWithChildren } from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type TextVariant = 'body' | 'eyebrow' | 'hero' | 'heroSmall' | 'title' | 'sectionTitle' | 'meta' | 'link';
type TextTone = 'default' | 'muted' | 'subtle';

type AppTextProps = PropsWithChildren<{
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}> &
  Pick<TextProps, 'numberOfLines'>;

// Variant styles don't change between themes (only fonts used, no colors)
const variantStyles: Record<TextVariant, TextStyle> = {
  body: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  eyebrow: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  hero: {
    fontFamily: theme.fonts.serif,
    fontSize: 40,
    lineHeight: 44,
  },
  heroSmall: {
    fontFamily: theme.fonts.serif,
    fontSize: 28,
    lineHeight: 32,
  },
  title: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 22,
    lineHeight: 28,
  },
  sectionTitle: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  meta: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
};

export function AppText({ children, variant = 'body', tone = 'default', style, numberOfLines }: AppTextProps) {
  const { theme: t } = useTheme();
  const toneStyle: TextStyle =
    tone === 'muted' ? { color: t.colors.mutedText }
    : tone === 'subtle' ? { color: t.colors.subtleText }
    : { color: t.colors.text };

  return (
    <Text numberOfLines={numberOfLines} style={[variantStyles[variant], toneStyle, style]}>
      {children}
    </Text>
  );
}
