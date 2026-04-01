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

/**
 * Formats the user profile for inclusion in an AI prompt.
 *
 * When `vibeOverride` is provided (the session's vibe/atmospheric keywords),
 * it replaces `fitPreference` and `stylePreference` for this request only.
 * The saved profile values are noted but explicitly marked as inactive so the
 * model does not fall back to them. The override is never persisted.
 */
export function formatProfileContext(profile: PromptProfile, vibeOverride?: string | null) {
  if (!profile) {
    return 'No saved user profile is available. Make reasonable wardrobe assumptions from the request alone.';
  }

  return [
    'User profile:',
    `- gender: ${emptyFallback(profile.gender)}`,
    `- heightCm: ${profile.heightCm}`,
    `- weightKg: ${profile.weightKg}`,
    vibeOverride
      ? `- fitPreference: ${vibeOverride} (session override — saved preference "${emptyFallback(profile.fitPreference)}" is not active for this request)`
      : `- fitPreference: ${emptyFallback(profile.fitPreference)}`,
    vibeOverride
      ? `- stylePreference: ${vibeOverride} (session override — saved preference "${emptyFallback(profile.stylePreference)}" is not active for this request)`
      : `- stylePreference: ${emptyFallback(profile.stylePreference)}`,
    `- budget: ${emptyFallback(profile.budget)}`,
    `- hairColor: ${emptyFallback(profile.hairColor)}`,
    `- skinTone: ${emptyFallback(profile.skinTone)}`,
    `- summerBottomPreference: ${emptyFallback(profile.summerBottomPreference)}`,
    `- notes: ${emptyFallback(profile.notes)}`,
  ].join('\n');
}
