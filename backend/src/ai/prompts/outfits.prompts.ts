import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import { buildBaseOutfitRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export function buildGenerateOutfitsInstructions(selectedTiers: OutfitTierSlug[]) {
  return [
    ...buildBaseOutfitRules(),
    'Return only structured JSON matching the provided schema.',
    `Return only the requested tier recommendations in this order: ${selectedTiers.join(', ')}.`,
    'Anchor the recommendations to the provided item or image evidence.',
    'If no image is provided, rely only on the text description and profile context.',
    'Do not mention missing information, policy, or the schema in the output.',
  ].join(' ');
}

export function buildGenerateOutfitsUserPrompt(
  input: GenerateOutfitsRequest,
  profile: PromptProfile,
  styleGuideContext?: string | null
) {
  return [
    formatProfileContext(profile),
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Styling request:',
    `- anchorItemDescription: ${input.anchorItemDescription.trim() || 'No text description provided.'}`,
    `- hasAnchorImage: ${Boolean(input.anchorImageId || input.anchorImageUrl)}`,
    `- selectedTiersFromClient: ${input.selectedTiers.join(', ')}`,
    `- photoPending: ${String(input.photoPending)}`,
    input.weatherContext
      ? `- currentSeason: ${input.weatherContext.season}`
      : '- currentSeason: unavailable',
    `Return recommendations only for: ${input.selectedTiers.join(', ')}.`,
    'Each recommendation should include a specific title, anchor item wording, key pieces, shoes, accessories, fit notes, why it works, styling direction, and detail notes.',
    'Use only the season to influence fabric weight, layering, palette, and overall styling direction. Do not infer extra constraints from current weather conditions.',
    'If the season is summer and the profile says prefer-trousers for summer bottoms, keep recommending longer bottoms instead of shorts.',
  ].join('\n');
}

export function buildRegenerateTierInstructions() {
  return [
    ...buildBaseOutfitRules(),
    'You are regenerating one tier of a menswear styling recommendation.',
    'Return only structured JSON matching the schema.',
    'Generate only the requested tier.',
    'The new recommendation must stay faithful to the anchor item and overall wardrobe direction while being materially different from the previous version.',
    'Do not repeat the previous title or the exact same key pieces.',
  ].join(' ');
}

export function buildRegenerateTierUserPrompt(input: {
  profile: PromptProfile;
  existing: OutfitResponse;
  tier: OutfitTierSlug;
  styleGuideContext?: string | null;
}) {
  const previousTier = input.existing.recommendations.find((item) => item.tier === input.tier);

  return [
    formatProfileContext(input.profile),
    input.styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Original styling request:',
    `- anchorItemDescription: ${input.existing.input.anchorItemDescription.trim() || 'No text description provided.'}`,
    `- hasAnchorImage: ${Boolean(input.existing.input.anchorImageId || input.existing.input.anchorImageUrl)}`,
    `- requestedTier: ${input.tier}`,
    input.existing.input.weatherContext
      ? `- currentSeason: ${input.existing.input.weatherContext.season}`
      : '- currentSeason: unavailable',
    previousTier
      ? [
          'Previous recommendation to replace:',
          `- title: ${previousTier.title}`,
          `- stylingDirection: ${previousTier.stylingDirection}`,
          `- keyPieces: ${previousTier.keyPieces.join('; ')}`,
          `- shoes: ${previousTier.shoes.join('; ')}`,
          `- accessories: ${previousTier.accessories.join('; ')}`,
          `- whyItWorks: ${previousTier.whyItWorks}`,
        ].join('\n')
      : 'There is no previous recommendation for the requested tier.',
    'Return one new recommendation for the requested tier only.',
    'Use only the season to shape the styling update. Do not treat current weather details as constraints.',
  ].join('\n');
}
