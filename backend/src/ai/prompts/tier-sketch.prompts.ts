import type { TierRecommendationDto } from '../../contracts/outfits.contracts.js';
import type { AnchorColorMetadata } from '../../modules/outfits/anchor-description.service.js';
import {
  ANCHOR_COLOR_HEX,
  buildAnchorColorBlockFromMetadata,
  buildAnchorColorBlockFromWord,
  extractAnchorColor,
  patternHint,
} from './sketch-anchor-color.js';
import { anchorIsMidLayer, isOuterwear, pieceLabel, shortenPieceName } from './sketch-piece-helpers.js';
import {
  HEADLESS_GUARD,
  QUALITY_ADDENDUM,
  QUALITY_ADDENDUM_2,
  STYLE_GUARD,
  STYLE_PREAMBLE,
} from './sketch-style-preamble.js';

// ── Outfit tier sketch prompt ─────────────────────────────────────────────────

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  anchorColorMetadata?: AnchorColorMetadata | null;
  subjectBrief?: string | null;
  recommendation: TierRecommendationDto;
}) {
  const anchor = input.anchorItemDescription.trim();
  const anchorName = shortenPieceName(anchor);

  const allKeyPieces = input.recommendation.keyPieces.slice(0, 4);
  const outerwearPieces = allKeyPieces.filter(isOuterwear);
  const remainingKeyPieces = allKeyPieces.filter((p) => !isOuterwear(p));
  const hasOuterwear = outerwearPieces.length > 0;
  const anchorMidLayer = anchorIsMidLayer(anchor);

  // Color lock block — vision metadata path is primary; text extraction is fallback.
  // Vision metadata contains a hex sampled directly from the uploaded image, which is
  // far more accurate than any static dictionary lookup.
  let anchorColorBlock: string | null = null;
  let anchorSuffix = '';

  if (input.anchorColorMetadata) {
    anchorColorBlock = buildAnchorColorBlockFromMetadata(anchorName, input.anchorColorMetadata);
    // Suffix for the anchor bullet line in the outfit list
    const meta = input.anchorColorMetadata;
    if (meta.isMultiColor && meta.colorPattern) {
      anchorSuffix = ` (color: ${meta.dominantColorName} ${meta.dominantColorHex}; ${meta.colorPattern})`;
    } else {
      anchorSuffix = ` (color: ${meta.dominantColorName} ${meta.dominantColorHex})`;
    }
  } else {
    // Fallback: extract color word from text description
    const anchorColor = extractAnchorColor(anchor);
    const anchorHex = anchorColor ? (ANCHOR_COLOR_HEX[anchorColor] ?? null) : null;
    const anchorPattern = patternHint(anchor);
    const anchorDetail = [
      anchorColor ? `color: ${anchorColor}${anchorHex ? ` ${anchorHex}` : ''}` : null,
      anchorPattern ? `pattern: ${anchorPattern}` : null,
    ].filter(Boolean).join(', ');
    anchorSuffix = anchorDetail ? ` (${anchorDetail})` : '';
    anchorColorBlock = anchorColor ? buildAnchorColorBlockFromWord(anchorName, anchorColor) : null;
  }

  // Build the outfit bullet list
  const outfitLines: string[] = [];

  if (hasOuterwear && anchorMidLayer) {
    outfitLines.push(`- inner layer (anchor): ${anchor}${anchorSuffix}`);
    outfitLines.push(`- outerwear (worn over anchor): ${outerwearPieces.map(pieceLabel).join(', ')}`);
  } else {
    outfitLines.push(`- anchor: ${anchor}${anchorSuffix}`);
    if (outerwearPieces.length > 0) {
      outfitLines.push(`- outerwear: ${outerwearPieces.map(pieceLabel).join(', ')}`);
    }
  }

  const remainingStr = remainingKeyPieces.map(pieceLabel).filter(Boolean).join(', ');
  if (remainingStr) {
    outfitLines.push(`- garments: ${remainingStr}`);
  }

  const shoes = input.recommendation.shoes.slice(0, 1).map(pieceLabel).filter(Boolean);
  if (shoes.length > 0) {
    outfitLines.push(`- shoes: ${shoes.join(', ')}`);
  }

  const accessories = input.recommendation.accessories.slice(0, 4).map(pieceLabel).filter(Boolean);
  if (accessories.length > 0) {
    outfitLines.push(`- accessories: ${accessories.join(', ')}`);
  }

  const outfitSection = `Outfit:\n${outfitLines.join('\n')}`;
  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    input.subjectBrief ?? null,
    STYLE_PREAMBLE,
    anchorColorBlock ?? null,
    outfitSection,
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
  ].filter(Boolean);

  return parts.join('\n\n');
}
