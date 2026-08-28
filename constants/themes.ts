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
// fashion-tech look: near-black warm brown, champagne-gold accent, cream
// text. Both light and dark resolve to the same palette on purpose — the
// reference has no separate light mode, and unifying them means every
// screen looks consistent regardless of the user's stored appearance
// preference. dark:true on BOTH keeps the status bar icons light-on-dark
// correctly in either case.
const NEWFIT_COLORS = {
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
} as const;

export const lightTheme: AppTheme = {
  dark: true,
  colors: NEWFIT_COLORS,
  fonts: FONTS,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: NEWFIT_COLORS,
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
