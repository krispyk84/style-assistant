import type { TripOutfitDay } from '@/services/trip-outfits';
import { normalizePiece, type LookRecommendation, type LookTierSlug, type OutfitPiece } from '@/types/look-request';

function pieceLabel(piece: OutfitPiece | string): string {
  return normalizePiece(piece).display_name;
}

/**
 * Converts a chosen LookRecommendation (from Build Around a Piece / Ask a
 * Stylist) into a full replacement for one trip day. Preserves everything
 * that identifies the day itself (id/tripId/dayIndex/date/dayType/
 * contextTags) from `originalDay` — only the outfit content changes.
 *
 * accessories/bag: LookRecommendation has no separate bag field (it's just
 * another accessory), while TripOutfitDay splits bag out on its own —
 * whichever accessory piece is tagged category "Bag" becomes `bag`, the rest
 * stay in `accessories`.
 *
 * Sketch: the picked look already had its own sketch generated on the
 * results screen — the user watched it render before tapping "Use for
 * [Day]" — so it's carried over directly rather than discarded and
 * regenerated from scratch. Only falls back to 'not_started' (letting
 * useTripResultsActions.ts's existing auto-generate effect kick off a fresh
 * one, the same way handleRemoveItemFromDay's full-composition changes do)
 * in the rare case the look's own sketch wasn't actually ready yet.
 */
export function mapLookRecommendationToTripDay(
  originalDay: TripOutfitDay,
  recommendation: LookRecommendation,
  tier: LookTierSlug,
): TripOutfitDay {
  const bagPiece = recommendation.accessories.find((piece) => normalizePiece(piece).metadata?.category === 'Bag');
  const otherAccessories = recommendation.accessories
    .filter((piece) => piece !== bagPiece)
    .map(pieceLabel);

  const sketchReady = recommendation.sketchStatus === 'ready' && !!recommendation.sketchImageUrl;

  return {
    ...originalDay,
    title: recommendation.title,
    formalityTier: tier,
    rationale: recommendation.whyItWorks,
    pieces: recommendation.keyPieces.map(pieceLabel),
    shoes: recommendation.shoes.map(pieceLabel).join(', '),
    bag: bagPiece ? pieceLabel(bagPiece) : null,
    accessories: otherAccessories,
    closetItemIds: recommendation.closetItemIds,
    framework: recommendation.framework,
    feedback: null,
    sketchStatus: sketchReady ? 'ready' : 'not_started',
    sketchUrl: sketchReady ? recommendation.sketchImageUrl! : undefined,
    sketchJobId: undefined,
  };
}
