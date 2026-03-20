import { PropsWithChildren } from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { theme } from '@/constants/theme';

type TextVariant = 'body' | 'bodyLarge' | 'eyebrow' | 'hero' | 'heroSmall' | 'display' | 'title' | 'sectionTitle' | 'caption' | 'meta' | 'link';
type TextTone = 'default' | 'muted' | 'subtle' | 'accent' | 'inverse';

type AppTextProps = PropsWithChildren<{
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}> &
  Pick<TextProps, 'numberOfLines'>;

const variantStyles: Record<TextVariant, TextStyle> = {
  body: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
  },
  bodyLarge: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '400',
  },
  eyebrow: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  hero: {
    fontFamily: theme.fonts.serif,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSmall: {
    fontFamily: theme.fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  display: {
    fontFamily: theme.fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  sectionTitle: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  caption: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  meta: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  link: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
};

const toneStyles: Record<TextTone, TextStyle> = {
  default: { color: theme.colors.text },
  muted: { color: theme.colors.mutedText },
  subtle: { color: theme.colors.subtleText },
  accent: { color: theme.colors.accent },
  inverse: { color: theme.colors.surface },
};

export function AppText({ children, variant = 'body', tone = 'default', style, numberOfLines }: AppTextProps) {
  return (
    <Text numberOfLines={numberOfLines} style={[variantStyles[variant], toneStyles[tone], style]}>
      {children}
    </Text>
  );
}
