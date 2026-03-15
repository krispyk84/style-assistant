import { PropsWithChildren } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

import { theme } from '@/constants/theme';

type TextVariant = 'body' | 'eyebrow' | 'hero' | 'heroSmall' | 'title' | 'sectionTitle' | 'meta' | 'link';
type TextTone = 'default' | 'muted' | 'subtle';

type AppTextProps = PropsWithChildren<{
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}>;

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

const toneStyles: Record<TextTone, TextStyle> = {
  default: { color: theme.colors.text },
  muted: { color: theme.colors.mutedText },
  subtle: { color: theme.colors.subtleText },
};

export function AppText({ children, variant = 'body', tone = 'default', style }: AppTextProps) {
  return <Text style={[variantStyles[variant], toneStyles[tone], style]}>{children}</Text>;
}
