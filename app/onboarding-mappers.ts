import type { Profile } from '@/types/profile';

// ── Shared types ───────────────────────────────────────────────────────────────

export const STEPS = [
  'name',
  'gender',
  'measurements',
  'fit',
  'style',
  'budget',
  'hair',
  'skin',
  'bottoms',
  'body-type',
  'temperature',
  'notes',
] as const;

export type Step = (typeof STEPS)[number];
export type WeightUnit = 'kg' | 'lbs';
export type HeightUnit = 'cm' | 'ft';

// Height and weight stored as raw input strings during the wizard; numeric
// strings are produced only at save time via the helpers below.
export type WizardProfile = Partial<Omit<Profile, 'heightCm' | 'weightKg' | 'name' | 'notes'>> & {
  name: string;
  heightCm: string;
  weightKg: string;
  notes: string;
};

export const EMPTY_WIZARD_PROFILE: WizardProfile = {
  name: '',
  heightCm: '',
  weightKg: '',
  notes: '',
};

// ── Conversion helpers ─────────────────────────────────────────────────────────

export function resolvedHeightCm(
  wizard: WizardProfile,
  heightUnit: HeightUnit,
  feet: string,
  inches: string,
): string {
  if (heightUnit === 'ft') {
    const totalInches = (parseFloat(feet) || 0) * 12 + (parseFloat(inches) || 0);
    return totalInches > 0 ? String(Math.round(totalInches * 2.54)) : '';
  }
  return wizard.heightCm;
}

export function resolvedWeightKg(wizard: WizardProfile, weightUnit: WeightUnit): string {
  if (weightUnit === 'lbs') {
    const lbs = parseFloat(wizard.weightKg);
    return lbs > 0 ? String(Math.round(lbs / 2.20462)) : '';
  }
  return wizard.weightKg;
}

// ── Profile builder ────────────────────────────────────────────────────────────

export function buildProfile(
  wizard: WizardProfile,
  heightUnit: HeightUnit,
  weightUnit: WeightUnit,
  feet: string,
  inches: string,
): Profile {
  return {
    name: wizard.name.trim(),
    gender: wizard.gender ?? 'man',
    heightCm: resolvedHeightCm(wizard, heightUnit, feet, inches),
    weightKg: resolvedWeightKg(wizard, weightUnit),
    fitPreference: wizard.fitPreference ?? 'tailored',
    stylePreference: wizard.stylePreference ?? 'smart-casual',
    budget: wizard.budget ?? 'premium',
    hairColor: wizard.hairColor ?? 'brown',
    skinTone: wizard.skinTone ?? 'medium',
    summerBottomPreference:
      wizard.gender === 'man'
        ? (wizard.summerBottomPreference ?? 'prefer-trousers')
        : 'prefer-trousers',
    temperatureUnit: wizard.temperatureUnit ?? 'celsius',
    notes: wizard.notes,
    bodyType: wizard.gender === 'man' ? wizard.bodyType : undefined,
  };
}
