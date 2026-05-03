import { findBestClosetMatch, getMatchConfidencePercent } from '@/lib/closet-match';
import type { LabeledPiece } from '@/lib/outfit-piece-display';
import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation, OutfitPiece } from '@/types/look-request';

export type { LabeledPiece };

// ── Match resolution ───────────────────────────────────────────────────────────

export function resolveMatch(
  piece: OutfitPiece,
  closetItems: ClosetItem[],
  matchMap: Record<string, ClosetItem | null | false>
): { item: ClosetItem | null; confidencePercent: number } {
  let item: ClosetItem | null;
  if (Object.prototype.hasOwnProperty.call(matchMap, piece.display_name)) {
    const entry = matchMap[piece.display_name];
    // false = rematch exhausted all candidates — do not fall back to local scoring
    if (entry === false) return { item: null, confidencePercent: 0 };
    item = entry ?? null;
  } else {
    // matchMap not yet populated — fall back to local scoring while closet loads
    item = findBestClosetMatch(piece, closetItems);
  }
  return {
    item,
    confidencePercent: item ? getMatchConfidencePercent(piece, item) : 0,
  };
}

// ── Anchor deduplication ───────────────────────────────────────────────────────

/**
 * Returns true if the keyPiece display_name is a duplicate of the anchor text.
 * Strips parenthetical styling notes before comparing so
 * "Charcoal Denim Western Shirt (tailored fit)" matches "Charcoal Denim Western Shirt".
 */
export function isAnchorDuplicate(anchorText: string, pieceDisplayName: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = norm(anchorText);
  const p = norm(pieceDisplayName);
  return Boolean(a && p && (p.startsWith(a) || a.startsWith(p)));
}

// ── Piece list construction ────────────────────────────────────────────────────

export function buildPiecesToCheck(
  recommendation: LookRecommendation,
  closetItems: ClosetItem[],
  matchMap: Record<string, ClosetItem | null | false>,
  anchorDescription?: string
): LabeledPiece[] {
  // Anchor piece first — always present, never closet-matched.
  // Priority: real user text > OpenAI-derived recommendation.anchorItem > generic fallback string > bare label.
  const GENERIC_FALLBACKS = ['Anchor item identified from uploaded image', 'Anchor item not provided'];
  const userText = anchorDescription?.trim() ?? '';
  const isGeneric = GENERIC_FALLBACKS.includes(userText);
  const anchorText =
    (userText && !isGeneric)
      ? userText
      : (recommendation.anchorItem?.trim() || userText || 'Anchor item');
  const rows: LabeledPiece[] = [
    { label: 'Anchor', value: anchorText, matchedClosetItem: null, confidencePercent: 0, isAnchor: true },
  ];

  recommendation.keyPieces.forEach((piece, index) => {
    // Safety net: skip any keyPiece that the backend already emitted as the anchor.
    // The backend deduplicates too, but this guards against stale cached responses.
    if (anchorText && isAnchorDuplicate(anchorText, piece.display_name)) return;
    const { item, confidencePercent } = resolveMatch(piece, closetItems, matchMap);
    rows.push({ label: labelForKeyPiece(piece, index), value: piece.display_name, matchedClosetItem: item, confidencePercent });
  });

  recommendation.shoes.forEach((shoe, index) => {
    const { item, confidencePercent } = resolveMatch(shoe, closetItems, matchMap);
    rows.push({ label: index === 0 ? 'Shoes' : `Shoe ${index + 1}`, value: shoe.display_name, matchedClosetItem: item, confidencePercent });
  });

  recommendation.accessories.forEach((accessory, index) => {
    const { item, confidencePercent } = resolveMatch(accessory, closetItems, matchMap);
    rows.push({ label: `Accessory ${index + 1}`, value: accessory.display_name, matchedClosetItem: item, confidencePercent });
  });

  return rows;
}

// ── Label helpers ──────────────────────────────────────────────────────────────

export function labelForKeyPiece(piece: OutfitPiece, index: number): string {
  // Use metadata.category for precise label when available
  if (piece.metadata?.category) {
    const cat = piece.metadata.category;
    if (cat === 'Suit') return 'Suit';
    if (['Blazer', 'Coat', 'Outerwear', 'Overshirt'].includes(cat)) return 'Outerwear';
    if (['Shirt', 'T-Shirt', 'Polo', 'Knitwear', 'Cardigan', 'Hoodie', 'Sweatshirt', 'Tank Top'].includes(cat)) return 'Top';
    if (['Trousers', 'Denim', 'Sweatpants'].includes(cat)) return 'Pants';
    if (['Shorts', 'Swimming Shorts'].includes(cat)) return 'Shorts';
    return cat;
  }

  const normalized = piece.display_name.toLowerCase();
  if (/(suit)/.test(normalized)) return 'Suit';
  if (/(blazer|jacket|coat|topcoat|overshirt|chore)/.test(normalized)) return 'Outerwear';
  if (/(shirt|tee|t-shirt|polo|crewneck|sweater|knit|cardigan|hoodie)/.test(normalized)) return 'Top';
  if (/(trouser|pant|pants|jean|denim)/.test(normalized)) return 'Pants';
  if (/(shorts)/.test(normalized)) return 'Shorts';

  return `Piece ${index + 1}`;
}
