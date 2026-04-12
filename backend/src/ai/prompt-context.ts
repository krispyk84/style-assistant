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
  bodyType?: string | null;
  fitTendency?: string | null;
  notes: string | null;
} | null;

function emptyFallback(value: string | null | undefined, fallback = 'Not provided') {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function formatFitTendency(fitTendency: string): string {
  switch (fitTendency) {
    case 'tight_chest_loose_below':
      return 'tight-chest-loose-below — RTW clothes run tight through shoulders and chest, loose below. Recommend relaxed or semi-relaxed cuts through the upper body and tapered or slim cuts below. Avoid double-breasted jackets. Favour stretch fabrics in structured pieces (shirts, blazers). RTW blazers and shirts will likely need extra room in the chest.';
    case 'loose_chest_tight_below':
      return 'loose-chest-tight-below — RTW clothes run loose through shoulders and chest, tight below. Recommend structured or lightly padded shoulders to add upper-body presence, slim-cut trousers and tapered silhouettes below. Avoid boxy or oversized cuts through the torso. RTW trousers may need to size up in the thigh.';
    default:
      return 'fits-well — standard RTW proportions apply, no fit-specific steering needed';
  }
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
    profile.bodyType ? `- bodyType: ${profile.bodyType}` : null,
    profile.fitTendency ? `- fitTendency: ${formatFitTendency(profile.fitTendency)}` : null,
    `- notes: ${emptyFallback(profile.notes)}`,
  ].filter(Boolean).join('\n');
}
