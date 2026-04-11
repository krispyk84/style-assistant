import { findBestClosetMatch, getMatchConfidencePercent } from '@/lib/closet-match';
import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation, OutfitPiece } from '@/types/look-request';
import { normalizePiece } from '@/types/look-request';

// ── Types ──────────────────────────────────────────────────────────────────────

export type LabeledPiece = {
  label: string;
  value: string;
  matchedClosetItem: ClosetItem | null;
  confidencePercent: number;
  isAnchor?: boolean;
};

// ── Match resolution ───────────────────────────────────────────────────────────

export function resolveMatch(
  piece: OutfitPiece,
  closetItems: ClosetItem[],
  matchMap?: Record<string, ClosetItem | null | false>
): { item: ClosetItem | null; confidencePercent: number } {
  const suggestion = piece.display_name;
  let item: ClosetItem | null;
  if (matchMap && Object.prototype.hasOwnProperty.call(matchMap, suggestion)) {
    const entry = matchMap[suggestion];
    // false = rematch exhausted all candidates — do not fall back to local scoring
    if (entry === false) {
      return { item: null, confidencePercent: 0 };
    }
    item = entry as ClosetItem | null;
  } else {
    // matchMap not yet populated — fall back to local scoring while closet loads
    item = findBestClosetMatch(piece, closetItems);
  }
  return {
    item,
    confidencePercent: item ? getMatchConfidencePercent(piece, item) : 0,
  };
}

// ── Piece list construction ────────────────────────────────────────────────────

export function buildLabeledPieces(
  recommendation: LookRecommendation,
  closetItems: ClosetItem[],
  matchMap?: Record<string, ClosetItem | null | false>,
  anchorDescription?: string
): LabeledPiece[] {
  const usedLabels = new Set<string>();

  // Anchor piece is always first and never closet-matched
  const anchorText = anchorDescription?.trim() ?? recommendation.anchorItem?.trim();
  const pieces: LabeledPiece[] = anchorText
    ? [{ label: 'Anchor', value: anchorText, matchedClosetItem: null, confidencePercent: 0, isAnchor: true }]
    : [];

  pieces.push(...recommendation.keyPieces.map((piece, index) => {
    const normalized = normalizePiece(piece);
    const { item, confidencePercent } = resolveMatch(normalized, closetItems, matchMap);
    return {
      label: uniqueLabel(labelForKeyPiece(normalized, index), usedLabels),
      value: normalized.display_name,
      matchedClosetItem: item,
      confidencePercent,
    };
  }));

  recommendation.shoes.forEach((shoe, index) => {
    const normalized = normalizePiece(shoe);
    const { item, confidencePercent } = resolveMatch(normalized, closetItems, matchMap);
    pieces.push({
      label: uniqueLabel(index === 0 ? 'Shoes' : `Shoe ${index + 1}`, usedLabels),
      value: normalized.display_name,
      matchedClosetItem: item,
      confidencePercent,
    });
  });

  recommendation.accessories.forEach((accessory, index) => {
    const normalized = normalizePiece(accessory);
    const { item, confidencePercent } = resolveMatch(normalized, closetItems, matchMap);
    pieces.push({
      label: uniqueLabel(`Accessory ${index + 1}`, usedLabels),
      value: normalized.display_name,
      matchedClosetItem: item,
      confidencePercent,
    });
  });

  return pieces;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function uniqueLabel(baseLabel: string, usedLabels: Set<string>): string {
  if (!usedLabels.has(baseLabel)) {
    usedLabels.add(baseLabel);
    return baseLabel;
  }

  let counter = 2;
  let nextLabel = `${baseLabel} ${counter}`;
  while (usedLabels.has(nextLabel)) {
    counter += 1;
    nextLabel = `${baseLabel} ${counter}`;
  }

  usedLabels.add(nextLabel);
  return nextLabel;
}

export function labelForKeyPiece(piece: OutfitPiece, index: number): string {
  // Use metadata.category when available — no text inference needed
  if (piece.metadata?.category) {
    const cat = piece.metadata.category;
    if (['Suit', 'Blazer', 'Coat', 'Outerwear', 'Overshirt'].includes(cat)) return 'Outerwear';
    if (['Shirt', 'T-Shirt', 'Polo', 'Knitwear', 'Cardigan', 'Hoodie', 'Sweatshirt', 'Tank Top'].includes(cat)) return 'Top';
    if (['Trousers', 'Denim', 'Sweatpants'].includes(cat)) return 'Pants';
    if (['Shorts', 'Swimming Shorts'].includes(cat)) return 'Shorts';
    return cat;
  }

  // Fallback text-based labeling for legacy pieces without metadata
  const norm = piece.display_name.toLowerCase();
  if (/(suit|blazer|jacket|coat|topcoat|overshirt|chore)/.test(norm)) return 'Outerwear';
  if (/(shirt|tee|t-shirt|polo|crewneck|sweater|knit|cardigan|hoodie)/.test(norm)) return 'Top';
  if (/(trouser|pant|pants|jean|denim)/.test(norm)) return 'Pants';
  if (/(shorts)/.test(norm)) return 'Shorts';

  return index === 0 ? 'Piece 1' : `Piece ${index + 1}`;
}
