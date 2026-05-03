import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { Step } from './onboarding-mappers';

// ── Step labels ───────────────────────────────────────────────────────────────

export const ONBOARDING_STEP_TITLES: Record<Step, string> = {
  name: 'What should we\ncall you?',
  gender: 'How do you\nidentify?',
  measurements: 'Your\nmeasurements.',
  fit: 'How do you like\nclothes to fit?',
  style: 'Pick your overall\nstyle direction.',
  budget: "What's your\nbudget range?",
  hair: "What's your\nhair color?",
  skin: "What's your\nskin tone?",
  bottoms: 'Warm weather\nbottoms.',
  'body-type': 'Your\nbody type.',
  'weight-distribution': 'Where do you\ncarry weight?',
  temperature: 'Temperature\npreference.',
  notes: 'Anything\nelse?',
};

export const ONBOARDING_STEP_HINTS: Record<Step, string> = {
  name: '',
  gender: '',
  measurements: 'Used to calibrate fit recommendations.',
  fit: 'How you want clothes to sit on the body.',
  style: 'Pick the closest overall direction.',
  budget: 'Helps recommendations stay realistic.',
  hair: 'Useful for palette and contrast cues.',
  skin: 'Used for color guidance.',
  bottoms: 'Choose whether summer looks can include shorts.',
  'body-type': 'Used to personalise outfit sketches.',
  'weight-distribution': 'Helps us personalise sketches and recommendations.',
  temperature: 'Your preferred unit across the app.',
  notes: 'Optional context like profession or climate.',
};

// ── Image assets ──────────────────────────────────────────────────────────────

export const VITTORIO_IMAGE = require('@/assets/images/vittorio.png');
export const ALESSANDRA_IMAGE = require('@/assets/images/alessandra.png');

export const FIT_IMAGES_MEN = {
  slim: require('@/assets/images/menswear_slim.png'),
  tailored: require('@/assets/images/menswear_tailored.png'),
  regular: require('@/assets/images/menswear_regular.png'),
  relaxed: require('@/assets/images/menswear_relaxed.png'),
};

export const FIT_IMAGES_WOMEN = {
  slim: require('@/assets/images/womenswear_slim.png'),
  tailored: require('@/assets/images/womenswear_tailored.png'),
  regular: require('@/assets/images/womenswear_regular.png'),
  relaxed: require('@/assets/images/womenswear_relaxed.png'),
};

export const BOTTOMS_IMAGES_MEN = {
  'shorts-ok': require('@/assets/images/menswear_shorts.png'),
  'prefer-trousers': require('@/assets/images/menswear_trousers.png'),
};

export const STYLE_IMAGES_MEN = {
  minimal: require('@/assets/images/menswear_minimal.png'),
  classic: require('@/assets/images/menswear_classic.png'),
  streetwear: require('@/assets/images/menswear_streetwear.png'),
  'smart-casual': require('@/assets/images/menswear_smartcasual.png'),
  editorial: require('@/assets/images/menswear_editorial.png'),
};

export const STYLE_IMAGES_WOMEN = {
  minimal: require('@/assets/images/womenswear_minimal.png'),
  classic: require('@/assets/images/womenswear_classic.png'),
  streetwear: require('@/assets/images/womenswear_streetwear.png'),
  'smart-casual': require('@/assets/images/womenswear_smartcasual.png'),
  editorial: require('@/assets/images/womenswear_editorial.png'),
};

export const BUDGET_IMAGES_MEN = {
  budget: require('@/assets/images/menswear_budget.png'),
  'mid-range': require('@/assets/images/menswear_midrange.png'),
  premium: require('@/assets/images/menswear_premium.png'),
  luxury: require('@/assets/images/menswear_luxury.png'),
};

export const BUDGET_IMAGES_WOMEN = {
  budget: require('@/assets/images/womenswear_budget.png'),
  'mid-range': require('@/assets/images/womenswear_midrange.png'),
  premium: require('@/assets/images/womenswear_premium.png'),
  luxury: require('@/assets/images/womenswear_luxury.png'),
};

export const TEMP_IMAGES = {
  celsius: require('@/assets/images/degrees_c.png'),
  fahrenheit: require('@/assets/images/degrees_f.png'),
};

export const BODY_TYPE_IMAGES = {
  slim: require('@/assets/images/menswear_bodytype_slim.png'),
  oval: require('@/assets/images/menswear_bodytype_oval.png'),
  rectangle: require('@/assets/images/menswear_bodytype_rectangle.png'),
  athletic: require('@/assets/images/menswear_bodytype_athletic.png'),
};

export const BODY_TYPE_LABELS: Record<string, string> = {
  slim: 'Slim',
  oval: 'Oval',
  rectangle: 'Rectangle',
  athletic: 'Athletic',
};

export const FEMALE_BODY_TYPE_IMAGES = {
  hourglass: require('@/assets/images/womenswear_bodytype_hourglass.png'),
  inverted_triangle: require('@/assets/images/womenswear_bodytype_inverted_triangle.png'),
  rectangle: require('@/assets/images/womenswear_bodytype_rectangle.png'),
  pear: require('@/assets/images/womenswear_bodytype_pear.png'),
  apple: require('@/assets/images/womenswear_bodytype_apple.png'),
  slim: require('@/assets/images/womenswear_bodytype_slim.png'),
};

export const FEMALE_BODY_TYPE_LABELS: Record<string, string> = {
  hourglass: 'Hourglass',
  inverted_triangle: 'Inverted Triangle',
  rectangle: 'Rectangle',
  pear: 'Pear',
  apple: 'Apple',
  slim: 'Slim',
};

export const WEIGHT_DISTRIBUTION_IMAGES = {
  even: require('@/assets/images/womenswear_weightdist_even.png'),
  midsection: require('@/assets/images/womenswear_weightdist_midsection.png'),
  hips: require('@/assets/images/womenswear_weightdist_hips.png'),
  chest: require('@/assets/images/womenswear_weightdist_chest.png'),
};

export const WEIGHT_DISTRIBUTION_LABELS: Record<string, string> = {
  even: 'Evenly throughout',
  midsection: 'More in my midsection',
  hips: 'More in my hips and thighs',
  chest: 'More in my chest and upper body',
};

// ── Color swatches ────────────────────────────────────────────────────────────

export const HAIR_SWATCHES: Record<string, string> = {
  black: '#1A1A1A',
  brown: '#6B3E2E',
  blonde: '#D4A840',
  red: '#A0412D',
  gray: '#9E9E9E',
  other: '#C8BDB6',
};

export const SKIN_SWATCHES: Record<string, string> = {
  fair: '#FDDBB4',
  light: '#F3C99F',
  medium: '#D9956E',
  olive: '#C68642',
  deep: '#7D4F3A',
  black: '#3B1F0E',
};

export function colorSwatch(color: string): ReactNode {
  return (
    <View
      style={{
        backgroundColor: color,
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: 999,
        borderWidth: 1,
        height: 52,
        width: 52,
      }}
    />
  );
}

// ── Shared text-input style ───────────────────────────────────────────────────

export const ONBOARDING_INPUT_STYLE = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 16,
  minHeight: 54,
  paddingHorizontal: spacing.md,
} as const;
