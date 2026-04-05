import type { Theme } from '@react-navigation/native';

export type AppTheme = {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    subtleSurface: string;
    card: string;
    border: string;
    text: string;
    mutedText: string;
    subtleText: string;
    accent: string;
    inverseText: string;
    danger: string;
    dangerSurface: string;
    overlay: string;
  };
  fonts: {
    sans: string;
    sansMedium: string;
    serif: string;
  };
};

const FONTS = {
  sans: 'AvenirNext-Regular',
  sansMedium: 'AvenirNext-DemiBold',
  serif: 'Georgia-Bold',
} as const;

export const lightTheme: AppTheme = {
  dark: false,
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
    inverseText: '#FFFFFF',
    danger: '#C95F4A',
    dangerSurface: '#FEF0EE',
    overlay: 'rgba(24, 18, 14, 0.52)',
  },
  fonts: FONTS,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: {
    background: '#0E0C0A',
    surface: '#181411',
    subtleSurface: '#1C1814',
    card: '#221C17',
    border: '#2E2620',
    text: '#F0EAE3',
    mutedText: '#9E8F85',
    subtleText: '#6B5E56',
    accent: '#C4822E',
    inverseText: '#0E0C0A',
    danger: '#E07060',
    dangerSurface: '#2A1210',
    overlay: 'rgba(0, 0, 0, 0.72)',
  },
  fonts: FONTS,
};

export function buildNavTheme(appTheme: AppTheme): Theme {
  return {
    dark: appTheme.dark,
    colors: {
      primary: appTheme.colors.accent,
      background: appTheme.colors.background,
      card: appTheme.colors.surface,
      text: appTheme.colors.text,
      border: appTheme.colors.border,
      notification: appTheme.colors.accent,
    },
    fonts: {
      regular: { fontFamily: FONTS.sans, fontWeight: '400' },
      medium: { fontFamily: FONTS.sansMedium, fontWeight: '500' },
      bold: { fontFamily: FONTS.sansMedium, fontWeight: '600' },
      heavy: { fontFamily: FONTS.serif, fontWeight: '700' },
    },
  };
}
