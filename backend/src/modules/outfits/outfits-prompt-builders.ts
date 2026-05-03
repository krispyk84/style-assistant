import type { GenerateOutfitsRequest, OutfitTierSlug } from '../../contracts/outfits.contracts.js';

/**
 * Removes keyPieces that duplicate the anchor item.
 * OpenAI sometimes echoes the anchor into keyPieces as a "top" slot despite
 * being told not to. Strips parenthetical styling notes before comparing so
 * "Charcoal Denim Western Shirt (tailored fit)" correctly matches
 * "Charcoal Denim Western Shirt".
 */
export function deduplicateKeyPieces<T extends { display_name: string }>(
  keyPieces: T[],
  anchorText: string
): T[] {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedAnchor = norm(anchorText);
  if (!normalizedAnchor) return keyPieces;
  return keyPieces.filter((p) => {
    const normalizedPiece = norm(p.display_name);
    return !normalizedPiece.startsWith(normalizedAnchor) && !normalizedAnchor.startsWith(normalizedPiece);
  });
}

export function getNormalizedAnchorItems(
  input: {
    anchorItems?: GenerateOutfitsRequest['anchorItems'];
    anchorItemDescription: string;
    anchorImageId?: string | null;
    anchorImageUrl?: string | null;
  }
) {
  if (input.anchorItems?.length) {
    return input.anchorItems
      .filter((item) => item.description.trim() || item.imageId || item.imageUrl)
      .map((item) => ({
        description: item.description,
        ...(item.imageId ? { imageId: item.imageId } : {}),
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      }));
  }

  return [
    {
      description: input.anchorItemDescription,
      ...(input.anchorImageId ? { imageId: input.anchorImageId } : {}),
      ...(input.anchorImageUrl ? { imageUrl: input.anchorImageUrl } : {}),
    },
  ].filter((item) => item.description.trim() || item.imageId || item.imageUrl);
}

export function getCanonicalAnchorDescription(input: {
  anchorItems?: GenerateOutfitsRequest['anchorItems'];
  anchorItemDescription: string;
  anchorImageId?: string | null;
  anchorImageUrl?: string | null;
}) {
  const anchorItems = getNormalizedAnchorItems(input);

  if (anchorItems.length > 1) {
    return anchorItems
      .map((item, index) => item.description.trim() || `Anchor item ${index + 1} identified from uploaded image`)
      .join(' | ');
  }

  const description = input.anchorItemDescription.trim();
  if (description) {
    return description;
  }

  if (input.anchorImageId || input.anchorImageUrl) {
    return 'Anchor item identified from uploaded image';
  }

  return 'Anchor item not provided';
}

// ── Style-guide query builders ────────────────────────────────────────────────

type OutfitStyleGuideProfile = {
  gender?: string | null;
  stylePreference?: string | null;
  fitPreference?: string | null;
  summerBottomPreference?: string | null;
} | null;

type AnchorItemForQuery = { description: string };

function formatAnchorItemsForQuery(anchorItems: AnchorItemForQuery[]): string[] {
  return anchorItems.map(
    (item, index) => `anchor item ${index + 1}: ${item.description.trim() || 'image-led reference'}`,
  );
}

export function buildOutfitGenerationStyleGuideQuery(args: {
  profile: OutfitStyleGuideProfile;
  anchorItems: AnchorItemForQuery[];
  tiersToGenerate: OutfitTierSlug[];
  manualSeason?: string | null;
  weatherSeason?: string | null;
  /** Already trimmed; pass null when no vibe was supplied. */
  vibeKeywords: string | null;
}) {
  const { profile, anchorItems, tiersToGenerate, manualSeason, weatherSeason, vibeKeywords } = args;
  return [
    profile?.gender === 'woman' ? 'womenswear styling guidance' : 'menswear styling guidance',
    ...formatAnchorItemsForQuery(anchorItems),
    `requested tiers: ${tiersToGenerate.join(', ')}`,
    (manualSeason || weatherSeason) ? `season: ${manualSeason ?? weatherSeason}` : null,
    // Vibe keywords override saved style/fit for retrieval — only one set is used
    vibeKeywords ? `style direction: ${vibeKeywords}` : null,
    !vibeKeywords && profile?.stylePreference ? `user style preference: ${profile.stylePreference}` : null,
    !vibeKeywords && profile?.fitPreference ? `user fit preference: ${profile.fitPreference}` : null,
    profile?.summerBottomPreference ? `summer bottoms preference: ${profile.summerBottomPreference}` : null,
  ].filter(Boolean).join(' | ');
}

export function buildOutfitRegenerationStyleGuideQuery(args: {
  profile: { gender?: string | null } | null;
  tier: OutfitTierSlug;
  anchorItems: AnchorItemForQuery[];
  manualSeason?: string | null;
  weatherSeason?: string | null;
  currentStylingDirection?: string | null;
}) {
  const { profile, tier, anchorItems, manualSeason, weatherSeason, currentStylingDirection } = args;
  return [
    profile?.gender === 'woman'
      ? 'womenswear styling guidance for regenerating one outfit tier'
      : 'menswear styling guidance for regenerating one outfit tier',
    `tier: ${tier}`,
    ...formatAnchorItemsForQuery(anchorItems),
    (manualSeason || weatherSeason) ? `season: ${manualSeason ?? weatherSeason}` : null,
    currentStylingDirection ? `current styling direction: ${currentStylingDirection}` : null,
  ].filter(Boolean).join(' | ');
}
