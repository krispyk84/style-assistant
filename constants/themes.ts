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
  serif: 'Didot',
} as const;

// "NewFit" redesign (see redesign/newfit-style branch) — moody editorial
// fashion-tech look, same champagne-gold/serif branding in both modes. The
// accent is deeper in light mode and paler in dark mode — same hue family,
// lightness tuned per background so it stays readable as both a fill (button
// backgrounds) and, via inverseText, correctly contrasts whichever text sits
// on top of it.

export const lightTheme: AppTheme = {
  dark: false,
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
  fonts: FONTS,
};

export const darkTheme: AppTheme = {
  dark: true,
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
