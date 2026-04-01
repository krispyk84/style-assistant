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
    'If vibe keywords are provided, treat them as a strong creative direction for silhouette, styling references, palette, detailing, and overall attitude while still honoring the selected tier.',
    'If no image is provided, rely only on the text description and profile context.',
    'Do not mention missing information, policy, or the schema in the output.',
  ].join(' ');
}

export function buildGenerateOutfitsUserPrompt(
  input: GenerateOutfitsRequest,
  profile: PromptProfile,
  styleGuideContext?: string | null
) {
  const anchorItems = input.anchorItems?.length
    ? input.anchorItems
    : [
        {
          description: input.anchorItemDescription,
          imageId: input.anchorImageId,
          imageUrl: input.anchorImageUrl,
        },
      ];

  // When vibe keywords are provided they override the profile's saved fit/style for this request
  const vibeOverride = input.vibeKeywords?.trim() || null;

  return [
    formatProfileContext(profile, vibeOverride),
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Styling request:',
    ...anchorItems.map(
      (item, index) =>
        `- anchorItem ${index + 1}: ${item.description.trim() || 'No text description provided.'} | hasImage: ${Boolean(item.imageId || item.imageUrl)}`
    ),
    input.vibeKeywords?.trim() ? `- vibeKeywords: ${input.vibeKeywords.trim()}` : '- vibeKeywords: none provided',
    `- selectedTiersFromClient: ${input.selectedTiers.join(', ')}`,
    `- photoPending: ${String(input.photoPending)}`,
    input.weatherContext
      ? `- currentSeason: ${input.weatherContext.season}`
      : '- currentSeason: unavailable',
    `Return recommendations only for: ${input.selectedTiers.join(', ')}.`,
    'Each recommendation should include a specific title, anchor item wording, key pieces, shoes, accessories, fit notes, why it works, styling direction, and detail notes.',
    'When vibe keywords are present, visibly reflect them in the recommendations instead of treating them as secondary decoration.',
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
    'If vibe keywords were provided, keep them prominent in the regenerated outfit.',
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

  // Apply the same vibe override that was used when the original request was generated
  const vibeOverride = input.existing.input.vibeKeywords?.trim() || null;

  return [
    formatProfileContext(input.profile, vibeOverride),
    input.styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Original styling request:',
    ...(input.existing.input.anchorItems?.length
      ? input.existing.input.anchorItems.map(
          (item, index) =>
            `- anchorItem ${index + 1}: ${item.description.trim() || 'No text description provided.'} | hasImage: ${Boolean(item.imageId || item.imageUrl)}`
        )
      : [
          `- anchorItemDescription: ${input.existing.input.anchorItemDescription.trim() || 'No text description provided.'}`,
          `- hasAnchorImage: ${Boolean(input.existing.input.anchorImageId || input.existing.input.anchorImageUrl)}`,
        ]),
    input.existing.input.vibeKeywords?.trim()
      ? `- vibeKeywords: ${input.existing.input.vibeKeywords.trim()}`
      : '- vibeKeywords: none provided',
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
    'Make the vibe keywords materially visible in the regenerated outfit if they were provided.',
    'Use only the season to shape the styling update. Do not treat current weather details as constraints.',
  ].join('\n');
}
