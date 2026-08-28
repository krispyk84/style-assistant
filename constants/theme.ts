import type { Theme } from '@react-navigation/native';

// Kept in sync with constants/themes.ts lightTheme — this static object is
// the default for components that don't call useTheme() (see CLAUDE.md
// "Static theme" convention), so it always renders light regardless of the
// user's dark-mode preference — same as before the NewFit redesign. Both
// files must be updated together.
export const theme = {
  colors: {
    background: '#FAF6EF',
    surface: '#FFFFFF',
    subtleSurface: '#F5EEE1',
    card: '#F0E6D5',
    border: '#E3D6C2',
    text: '#241C15',
    mutedText: '#7A6C5D',
    subtleText: '#A0937F',
    accent: '#A9793A',
    inverseText: '#FFFFFF',
    danger: '#C95F4A',
    dangerSurface: '#FEF0EE',
    overlay: 'rgba(24, 18, 14, 0.52)',
  },
  fonts: {
    sans: 'AvenirNext-Regular',
    sansMedium: 'AvenirNext-DemiBold',
    serif: 'Didot',
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
