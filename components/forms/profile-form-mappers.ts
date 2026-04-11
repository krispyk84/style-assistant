import type { Profile } from '@/types/profile';

// ── Shared types ───────────────────────────────────────────────────────────────

export type HeightUnit = 'cm' | 'ft';
export type WeightUnit = 'kg' | 'lbs';

// ── Normalisation ──────────────────────────────────────────────────────────────

export function normalizeProfile(p: Profile): Profile {
  const g = p.gender as string;
  const heightN = parseFloat(p.heightCm);
  return {
    ...p,
    gender: g === 'prefer-not-to-say' ? 'non-binary' : p.gender,
    heightCm: Number.isFinite(heightN) && heightN > 0 ? String(Math.round(heightN)) : p.heightCm,
  };
}

function roundMeasurementStr(s: string): string {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : s;
}

// ── Unit converters ────────────────────────────────────────────────────────────

export function centimetersToFeetInches(cm: string): { feet: string; inches: string } {
  const numeric = Number(cm);
  if (!Number.isFinite(numeric) || numeric <= 0) return { feet: '', inches: '' };
  const totalInches = numeric / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet: String(feet), inches: String(inches) };
}

export function feetInchesToCentimeters(feet: string, inches: string): string {
  const f = parseFloat(feet) || 0;
  const i = parseFloat(inches) || 0;
  const totalInches = f * 12 + i;
  return totalInches > 0 ? Math.round(totalInches * 2.54).toString() : '';
}

export function kilogramsToPounds(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return Math.round(numeric * 2.20462).toString();
}

export function poundsToKilograms(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return Math.round(numeric / 2.20462).toString();
}

// ── Payload builder ────────────────────────────────────────────────────────────

export function buildProfilePayload(
  profile: Profile,
  heightUnit: HeightUnit,
  heightFeet: string,
  heightInches: string,
  weightUnit: WeightUnit,
  weightValue: string,
): Profile {
  return {
    ...profile,
    heightCm: heightUnit === 'ft' ? feetInchesToCentimeters(heightFeet, heightInches) : profile.heightCm,
    weightKg: weightUnit === 'lbs' ? poundsToKilograms(weightValue) : weightValue,
  };
}

// ── Weight value initialiser ───────────────────────────────────────────────────
// Exported so useProfileForm can initialise weightValue from initialValue.weightKg
// without duplicating the rounding logic.

export function initialWeightValue(weightKg: string): string {
  return roundMeasurementStr(weightKg);
}
