import type { Theme } from '@react-navigation/native';

export const theme = {
  colors: {
    background: '#FCFAF7',
    surface: '#FFFFFF',
    subtleSurface: '#F7F2EE',
    card: '#F5EDE8',
    border: '#E8DED6',
    text: '#221C18',
    mutedText: '#6F625A',
    subtleText: '#9E8F85',
    accent: '#A56A1F',
    danger: '#C95F4A',
  },
  fonts: {
    sans: 'AvenirNext-Regular',
    sansMedium: 'AvenirNext-DemiBold',
    serif: 'Georgia-Bold',
  },
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const navTheme: Theme = {
  dark: false,
  colors: {
    primary: theme.colors.accent,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.accent,
  },
  fonts: {
    regular: {
      fontFamily: theme.fonts.sans,
      fontWeight: '400',
    },
    medium: {
      fontFamily: theme.fonts.sansMedium,
      fontWeight: '500',
    },
    bold: {
      fontFamily: theme.fonts.sansMedium,
      fontWeight: '600',
    },
    heavy: {
      fontFamily: theme.fonts.serif,
      fontWeight: '700',
    },
  },
};
