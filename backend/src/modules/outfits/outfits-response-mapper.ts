import type { OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import type { TieredOutfitGeneration } from './outfits.schemas.js';
import { deduplicateKeyPieces } from './outfits-prompt-builders.js';

type OutfitRecommendationInput = TieredOutfitGeneration['recommendations'][number];

export function buildStableSketchUrl(baseUrl: string, requestId: string, tier: OutfitTierSlug, version?: string | number): string {
  const url = `${baseUrl}/outfits/${requestId}/sketch/${tier}`;
  return version === undefined ? url : `${url}?v=${encodeURIComponent(String(version))}`;
}

export function mapOutfitRecommendation(
  recommendation: OutfitRecommendationInput,
  tier: OutfitTierSlug,
  sketchImageUrl: string,
  variantIndex: number,
  fallbackAnchorDescription: string,
) {
  const anchorText = recommendation.anchorItem.trim() || fallbackAnchorDescription;
  return {
    ...recommendation,
    tier,
    anchorItem: anchorText,
    keyPieces: deduplicateKeyPieces(recommendation.keyPieces, anchorText),
    sketchStatus: 'pending' as const,
    sketchImageUrl,
    sketchStorageKey: null,
    sketchMimeType: null,
    sketchImageData: null,
    variantIndex,
  };
}
