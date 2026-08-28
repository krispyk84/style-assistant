import type { Theme } from '@react-navigation/native';

// Kept in sync with constants/themes.ts NEWFIT_COLORS — this static object
// is the default for components that don't call useTheme() (see CLAUDE.md
// "Static theme" convention). Both files must be updated together.
export const theme = {
  colors: {
    background: '#151210',
    surface: '#1F1A15',
    subtleSurface: '#251F19',
    card: '#2A241D',
    border: '#38312A',
    text: '#F3ECE1',
    mutedText: '#B3A395',
    subtleText: '#7C6E61',
    accent: '#C9A876',
    inverseText: '#1A140F',
    danger: '#E2735F',
    dangerSurface: '#2D1512',
    overlay: 'rgba(10, 8, 6, 0.75)',
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
  dark: true,
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
