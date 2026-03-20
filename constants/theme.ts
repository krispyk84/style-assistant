import type { Theme } from '@react-navigation/native';

export const theme = {
  colors: {
    // Premium neutral palette with warm undertones
    background: '#F8F6F3',
    surface: '#FFFFFF',
    surfaceElevated: '#FDFCFB',
    card: '#FFFFFF',
    border: '#E5E0DB',
    borderSubtle: '#EFEBE7',
    // Rich, sophisticated text colors
    text: '#1A1614',
    mutedText: '#6B5E56',
    subtleText: '#9B8E85',
    // Refined coral/terracotta accent
    accent: '#D4785C',
    accentLight: '#F5E6E0',
    accentDark: '#B85A3F',
    // Semantic colors
    success: '#5B8A72',
    successLight: '#E8F2ED',
    danger: '#C45C4A',
    dangerLight: '#F8EEEC',
  },
  fonts: {
    sans: 'System',
    sansMedium: 'System',
    serif: 'Georgia',
  },
  shadows: {
    sm: {
      shadowColor: '#1A1614',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#1A1614',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1A1614',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 5,
    },
  },
  radius: {
    sm: 12,
    md: 20,
    lg: 28,
    xl: 36,
    full: 999,
  },
} as const;

export const spacing = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
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
