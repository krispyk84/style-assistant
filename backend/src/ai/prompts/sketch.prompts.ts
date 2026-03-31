import type { TierRecommendationDto } from '../../contracts/outfits.contracts.js';

export function buildClosetItemSketchPrompt(input: { itemDescription: string }) {
  return [
    'Editorial menswear fashion illustration, watercolor and ink, hand-rendered, luxury lookbook style.',
    'Single garment displayed on a clean soft cream white background.',
    'Light and airy watercolor washes, delicate ink outlines, soft neutral tones.',
    'No figure, no mannequin, no text, no logos, no watermarks.',
    `Garment: ${input.itemDescription}.`,
    'Portrait orientation, full garment visible, premium wardrobe catalogue presentation.',
  ].join(' ');
}

function formatList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function buildTierSketchPrompt(input: {
  tierLabel: string;
  anchorItemDescription: string;
  recommendation: TierRecommendationDto;
}) {
  return [
    'Editorial menswear fashion illustration, watercolor and ink, hand-rendered, luxury lookbook style.',
    'Full-length headless mannequin showing the complete outfit from shoulders to shoes, soft cream white background, light and airy.',
    'Accessories neatly arranged alongside the figure.',
    'Delicate watercolor washes, visible paper texture, confident ink outlines, soft warm neutral tones.',
    'No faces, no text, no logos, no watermarks.',
    `Tier: ${input.tierLabel}.`,
    `Anchor item: ${input.anchorItemDescription}.`,
    `Outfit: ${input.recommendation.title}.`,
    `Key pieces: ${input.recommendation.keyPieces.join(', ')}.`,
    `Shoes: ${input.recommendation.shoes.join(', ')}.`,
    `Accessories: ${input.recommendation.accessories.join(', ')}.`,
    `Palette: ${input.recommendation.stylingDirection}.`,
    'Portrait orientation, full figure visible head to toe, premium styling app presentation.',
  ].join(' ');
}
