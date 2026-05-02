import { type SelectorOption } from '@/components/ui/selector-grid';
import { theme } from '@/constants/theme';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FEMALE_BODY_TYPE_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
  WEIGHT_DISTRIBUTION_OPTIONS,
  type Profile,
} from '@/types/profile';
import {
  BODY_TYPE_IMAGES,
  BODY_TYPE_LABELS,
  BOTTOMS_IMAGES_MEN,
  BUDGET_IMAGES_MEN,
  BUDGET_IMAGES_WOMEN,
  FEMALE_BODY_TYPE_IMAGES,
  FEMALE_BODY_TYPE_LABELS,
  FIT_IMAGES_MEN,
  FIT_IMAGES_WOMEN,
  HAIR_SWATCHES,
  SKIN_SWATCHES,
  STYLE_IMAGES_MEN,
  STYLE_IMAGES_WOMEN,
  TEMP_IMAGES,
  WEIGHT_DISTRIBUTION_IMAGES,
  WEIGHT_DISTRIBUTION_LABELS,
  colorSwatch,
} from './onboarding-assets';

// ── Gender-dependent builders ─────────────────────────────────────────────────

// `gender` is sourced from `WizardProfile`, which makes it optional during onboarding —
// the original code reads `=== 'man'` and falls through to the women's set otherwise.

export function buildFitOptions(gender: Profile['gender'] | undefined): SelectorOption<Profile['fitPreference']>[] {
  const images = gender === 'man' ? FIT_IMAGES_MEN : FIT_IMAGES_WOMEN;
  return FIT_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: images[v as keyof typeof images],
  }));
}

export function buildStyleOptions(gender: Profile['gender'] | undefined): SelectorOption<Profile['stylePreference']>[] {
  const images = gender === 'man' ? STYLE_IMAGES_MEN : STYLE_IMAGES_WOMEN;
  return STYLE_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: images[v as keyof typeof images],
  }));
}

export function buildBudgetOptions(gender: Profile['gender'] | undefined): SelectorOption<Profile['budget']>[] {
  const images = gender === 'man' ? BUDGET_IMAGES_MEN : BUDGET_IMAGES_WOMEN;
  return BUDGET_OPTIONS.map((v) => ({
    value: v,
    image: images[v as keyof typeof images],
  }));
}

export function buildBodyTypeOptions(
  gender: Profile['gender'] | undefined,
): SelectorOption<NonNullable<Profile['bodyType']>>[] {
  return gender === 'woman'
    ? FEMALE_BODY_TYPE_OPTIONS.map((v) => ({
        value: v,
        label: FEMALE_BODY_TYPE_LABELS[v],
        image: FEMALE_BODY_TYPE_IMAGES[v],
      }))
    : BODY_TYPE_OPTIONS.map((v) => ({
        value: v,
        label: BODY_TYPE_LABELS[v],
        image: BODY_TYPE_IMAGES[v],
      }));
}

// ── Gender-independent option lists ───────────────────────────────────────────

export const HAIR_OPTIONS: SelectorOption<Profile['hairColor']>[] = HAIR_COLOR_OPTIONS.map((v) => ({
  value: v,
  thumbnailContent: colorSwatch(HAIR_SWATCHES[v] ?? theme.colors.border),
}));

export const SKIN_OPTIONS: SelectorOption<Profile['skinTone']>[] = SKIN_TONE_OPTIONS.map((v) => ({
  value: v,
  thumbnailContent: colorSwatch(SKIN_SWATCHES[v] ?? theme.colors.border),
}));

export const SUMMER_OPTIONS: SelectorOption<Profile['summerBottomPreference']>[] = [
  { value: 'shorts-ok', label: 'Shorts OK', image: BOTTOMS_IMAGES_MEN['shorts-ok'] },
  { value: 'prefer-trousers', label: 'Prefer Trousers', image: BOTTOMS_IMAGES_MEN['prefer-trousers'] },
];

export const TEMP_OPTIONS: SelectorOption<Profile['temperatureUnit']>[] = [
  { value: 'celsius', label: '°C  Celsius', image: TEMP_IMAGES.celsius },
  { value: 'fahrenheit', label: '°F  Fahrenheit', image: TEMP_IMAGES.fahrenheit },
];

export const WEIGHT_DIST_OPTIONS: SelectorOption<NonNullable<Profile['weightDistribution']>>[] =
  WEIGHT_DISTRIBUTION_OPTIONS.map((v) => ({
    value: v,
    label: WEIGHT_DISTRIBUTION_LABELS[v],
    image: WEIGHT_DISTRIBUTION_IMAGES[v],
  }));
