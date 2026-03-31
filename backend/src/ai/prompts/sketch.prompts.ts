import type { TierRecommendationDto } from '../../contracts/outfits.contracts.js';

export function buildClosetItemSketchPrompt(input: { itemDescription: string }) {
  return [
    'Editorial menswear fashion illustration, watercolor wash and ink, hand-rendered, luxury lookbook style.',
    'Single garment displayed on a clean neutral or white background, no figure or mannequin.',
    'Loose expressive brushwork, visible paper texture, confident ink outlines, soft colour washes.',
    'No text, no logos, no watermarks, no other garments or accessories.',
    `Garment: ${input.itemDescription}`,
    'Portrait orientation. Premium wardrobe catalogue presentation.',
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
    'Full outfit on a headless mannequin or laid flat, soft neutral background.',
    'Loose expressive brushwork, visible paper texture, confident ink outlines, warm tones.',
    'No text, no logos, no watermarks, no faces.',
    `Tier: ${input.tierLabel}.`,
    `Anchor item: ${input.anchorItemDescription}.`,
    `Outfit: ${input.recommendation.title}.`,
    `Key pieces: ${input.recommendation.keyPieces.join(', ')}.`,
    `Shoes: ${input.recommendation.shoes.join(', ')}.`,
    `Accessories: ${input.recommendation.accessories.join(', ')}.`,
    `Palette: ${input.recommendation.stylingDirection}.`,
    'Portrait orientation. Premium styling app presentation.',
  ].join(' ');
}
