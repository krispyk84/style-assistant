import type { OutfitPieceDto, TierRecommendationDto } from '../../contracts/outfits.contracts.js';

export function buildClosetItemSketchPrompt(input: { itemDescription: string }) {
  return [
    'Create a menswear editorial fashion illustration of a single garment on a clean presentation.',
    'Visual style: luxury menswear sketch, hand-rendered marker and watercolor wash, confident ink outlines, refined retail lookbook presentation.',
    'Show only this one piece — do not add other garments, people, or accessories.',
    'Do not add any words, logos, watermarks, UI chrome, or marketing copy.',
    'Favor a soft neutral or white background with premium menswear presentation.',
    `Garment: ${input.itemDescription}`,
    'Compose this as a polished portrait-oriented single-piece menswear sketch suitable for a premium wardrobe cataloguing app.',
  ].join('\n');
}

function pieceLabel(piece: OutfitPieceDto): string {
  return piece.display_name;
}

function formatList(items: OutfitPieceDto[] | string[]) {
  if (!items.length) return '- none';
  return items.map((item) => `- ${typeof item === 'string' ? item : pieceLabel(item)}`).join('\n');
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
}) {
  return [
    'Create a menswear editorial fashion illustration of a single outfit on a mannequin or laid-out presentation board.',
    'Visual style: luxury menswear sketch, hand-rendered marker and watercolor wash, confident ink outlines, refined retail lookbook presentation.',
    'Do not add any words, logos, sale text, watermarks, UI chrome, or marketing copy.',
    'Show the full outfit clearly and keep the garments true to the styling details below.',
    'Favor soft neutral backgrounds and premium menswear presentation.',
    `Tier: ${input.tierLabel}`,
    `Anchor item: ${input.anchorItemDescription}`,
    `Outfit title: ${input.recommendation.title}`,
    `Anchor piece rendering: ${input.recommendation.anchorItem}`,
    'Key pieces:',
    formatList(input.recommendation.keyPieces),
    'Shoes:',
    formatList(input.recommendation.shoes),
    'Accessories:',
    formatList(input.recommendation.accessories),
    'Fit notes:',
    formatList(input.recommendation.fitNotes),
    `Palette and mood: ${input.recommendation.stylingDirection}`,
    `Why it works: ${input.recommendation.whyItWorks}`,
    'Compose this as a polished portrait-oriented menswear sketch suitable for a premium styling assistant app.',
  ].join('\n');
}
