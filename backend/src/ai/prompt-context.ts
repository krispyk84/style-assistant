type PromptProfile = {
  gender: string;
  heightCm: number;
  weightKg: number;
  fitPreference: string;
  stylePreference: string;
  budget: string;
  hairColor: string;
  skinTone: string;
  summerBottomPreference?: string;
  notes: string | null;
} | null;

function emptyFallback(value: string | null | undefined, fallback = 'Not provided') {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function formatProfileContext(profile: PromptProfile) {
  if (!profile) {
    return 'No saved user profile is available. Make reasonable wardrobe assumptions from the request alone.';
  }

  return [
    'User profile:',
    `- gender: ${emptyFallback(profile.gender)}`,
    `- heightCm: ${profile.heightCm}`,
    `- weightKg: ${profile.weightKg}`,
    `- fitPreference: ${emptyFallback(profile.fitPreference)}`,
    `- stylePreference: ${emptyFallback(profile.stylePreference)}`,
    `- budget: ${emptyFallback(profile.budget)}`,
    `- hairColor: ${emptyFallback(profile.hairColor)}`,
    `- skinTone: ${emptyFallback(profile.skinTone)}`,
    `- summerBottomPreference: ${emptyFallback(profile.summerBottomPreference)}`,
    `- notes: ${emptyFallback(profile.notes)}`,
  ].join('\n');
}
