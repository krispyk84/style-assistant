export const GENDER_OPTIONS = ['man', 'woman', 'non-binary'] as const;
export const FIT_PREFERENCE_OPTIONS = ['slim', 'tailored', 'regular', 'relaxed'] as const;
export const STYLE_PREFERENCE_OPTIONS = ['minimal', 'classic', 'streetwear', 'smart-casual', 'editorial'] as const;
export const BUDGET_OPTIONS = ['budget', 'mid-range', 'premium', 'luxury'] as const;
export const HAIR_COLOR_OPTIONS = ['black', 'brown', 'blonde', 'red', 'gray', 'other'] as const;
export const SKIN_TONE_OPTIONS = ['fair', 'light', 'medium', 'olive', 'deep', 'black'] as const;
export const SUMMER_BOTTOM_OPTIONS = ['shorts-ok', 'prefer-trousers'] as const;
export const TEMPERATURE_UNIT_OPTIONS = ['celsius', 'fahrenheit'] as const;
export const BODY_TYPE_OPTIONS = ['athletic', 'rectangle', 'oval', 'slim'] as const;
export const FIT_TENDENCY_OPTIONS = ['fits_well', 'tight_chest_loose_below', 'loose_chest_tight_below'] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type FitPreference = (typeof FIT_PREFERENCE_OPTIONS)[number];
export type StylePreference = (typeof STYLE_PREFERENCE_OPTIONS)[number];
export type BudgetPreference = (typeof BUDGET_OPTIONS)[number];
export type HairColor = (typeof HAIR_COLOR_OPTIONS)[number];
export type SkinTone = (typeof SKIN_TONE_OPTIONS)[number];
export type SummerBottomPreference = (typeof SUMMER_BOTTOM_OPTIONS)[number];
export type TemperatureUnit = (typeof TEMPERATURE_UNIT_OPTIONS)[number];
export type BodyType = (typeof BODY_TYPE_OPTIONS)[number];
export type FitTendency = (typeof FIT_TENDENCY_OPTIONS)[number];

export type Profile = {
  name: string;
  gender: Gender;
  heightCm: string;
  weightKg: string;
  fitPreference: FitPreference;
  stylePreference: StylePreference;
  budget: BudgetPreference;
  hairColor: HairColor;
  skinTone: SkinTone;
  summerBottomPreference: SummerBottomPreference;
  temperatureUnit: TemperatureUnit;
  notes: string;
  bodyType?: BodyType;
  fitTendency?: FitTendency;
};

export type PersistedSession = {
  onboardingCompleted: boolean;
  profile: Profile | null;
};

export type ProfileValidationErrors = Partial<Record<keyof Profile, string>>;
