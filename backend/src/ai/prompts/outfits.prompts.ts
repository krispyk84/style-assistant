import type { GenerateOutfitsRequest, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';
import { buildBaseOutfitRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

/**
 * Female styling framework drawn from intentional wardrobe-curation principles.
 *
 * Applied only when profile.gender === 'woman'. Guides the model toward
 * womenswear-appropriate outfit logic while still respecting the user's
 * chosen style direction (minimal, classic, editorial, streetwear, etc.).
 */
function buildFemaleStyleFramework(): string {
  return [
    'FEMALE STYLING FRAMEWORK — apply this for every recommendation:',
    '- Outfit composition: build each outfit with a deliberate balance of piece types. A strong key piece (versatile, mid-formality workhorse like tailored trousers, a structured jacket, or a quality knit) should anchor the look. Layer in basics (clean, neutral foundations) and at most one statement piece (bold detail, distinctive color, or strong silhouette) per outfit. Avoid stacking multiple statement pieces or filling the look with all basics.',
    '- Silhouette and proportion: contrast volume deliberately. If the top is relaxed or oversized, the bottom should be more fitted or streamlined (and vice versa). Avoid competing volume at both top and bottom simultaneously. Consider how the overall silhouette reads — A-line, column, hourglass emphasis, relaxed — and make it intentional.',
    '- Color palette coherence: 2–3 colors per outfit in a deliberate relationship. Establish one dominant tone (often a neutral), one main color that expresses the style direction, and optionally one accent. Colors should feel chosen, not accidental. Warm and cool tones should be mixed deliberately, not arbitrarily.',
    '- Texture pairing: include at least two distinct fabric textures per outfit to create intentional depth — e.g., a structured knit with tailored wool, matte jersey with a subtle satin-finish slip, crisp cotton with draped crepe, stiff denim with something soft. Texture contrast elevates a look from assembled to styled.',
    '- Outfit formulas: anchor one strong piece and build outward from it with intention. Examples: wide-leg tailored trousers + fine-gauge ribbed turtleneck + pointed-toe flat + minimal earring; silk midi skirt + tucked relaxed blouse + block-heel mule + delicate necklace; straight-leg dark jeans + chunky cardigan + simple tee + clean sneaker.',
    '- Layering variety: reach for soft layering options — cardigans, fine-gauge knits, relaxed overshirts, draped wrap coats, fluid cover-ups — rather than defaulting to a structured blazer. A tailored blazer is one option among many, not a reflex. For casual and smart-casual tiers in particular, knitwear and softer layering pieces create more natural, wearable silhouettes.',
    '- Bottom variety: actively consider skirts and dresses alongside trousers and jeans. For most styling requests, at least one tier should feature a skirt (midi, A-line, wrap, bias-cut, pleated) or dress (shirt dress, slip dress, wrap dress, knit dress). Do not default every tier to pants — varied bottom choices show range and womenswear specificity.',
    '- Style direction applies: a woman selecting streetwear should receive streetwear; classic should receive classic; editorial should receive editorial; minimal should receive minimal. But all should be filtered through a womenswear lens — not defaulted to menswear templates with feminine substitutions.',
    '- Fit specificity: call out fit details that matter for the wearer — high-rise vs. mid-rise, cropped vs. longline, A-line vs. straight-cut, relaxed vs. fitted shoulder. Each piece should fit the body without pulling, sagging, or requiring constant readjustment.',
    '- Avoid masculine defaults: do not default to menswear silhouettes, menswear color logic, or menswear piece choices unless the user\'s style profile or vibe keywords explicitly call for androgynous or masculine-influenced dressing.',
    '- Accessories: treat as deliberate finishing choices that reinforce the outfit\'s direction, not as afterthoughts. One well-chosen accessory (a structured bag, a layered necklace, a statement earring) reads stronger than several undirected ones.',
  ].join('\n');
}

function buildFemaleWeightDistributionGuidance(weightDistribution: string): string | null {
  const guidance: Record<string, string> = {
    midsection: 'Recommend empire waist, wrap tops, and flowy fabrics that skim rather than cling through the waist. Longer tops that cover and skim the midsection work well. Avoid cropped tops, tight waistbands, tucked-in styles, and belted pieces at the natural waist. Note: sizing may differ between top and bottom.',
    hips: 'Recommend A-line and flared skirts, wide-leg trousers, and structured or detailed tops to balance the lower body. Darker colours below work well. Avoid clingy fabrics on the thighs, tapered trousers, and horizontal details on the hips. Note: may need to size up in bottoms relative to tops.',
    chest: 'Recommend V-necks, wrap tops, and structured support under fitted tops. Avoid high necklines, ruffles or decorative detail on the chest, and boxy tops that add volume where it is not needed. Note: blazers and structured jackets may need to size up for chest room.',
  };
  const note = guidance[weightDistribution];
  return note ? `FEMALE WEIGHT DISTRIBUTION GUIDANCE — ${weightDistribution}: ${note}` : null;
}

function buildFemaleBodyTypeGuidance(bodyType: string): string | null {
  const guidance: Record<string, string> = {
    hourglass: 'favour pieces that follow the natural silhouette — wrap styles, belted pieces, fitted cuts, V-necks, A-line skirts. Avoid boxy or shapeless garments that obscure the waist.',
    inverted_triangle: 'balance the broader upper body with fuller skirts, A-line or wide-leg trousers, and volume at the hip. Avoid heavy shoulder detail, boat necks, or wide horizontal stripes. Favour V-necks.',
    rectangle: 'create curves with peplum tops, belted pieces, wrap styles, and garments with waist definition. Avoid straight shapeless cuts. Favour pieces that add volume at the hip or bust.',
    pear: 'balance hips with structured or detailed tops, statement shoulders, bold print or texture up top. A-line skirts and wide-leg trousers work well below. Avoid clingy fabrics on the lower body.',
    apple: 'elongate the torso with empire waist, wrap dresses, and flowy tops that skim rather than cling. Favour V-necks and vertical lines. Avoid tight waistbands and cropped tops.',
    slim: 'can wear most silhouettes well. Add dimension with texture and layering. Avoid very oversized pieces that overwhelm the frame.',
  };
  const note = guidance[bodyType];
  return note ? `FEMALE BODY TYPE GUIDANCE — ${bodyType}: ${note}` : null;
}

export function buildGenerateOutfitsInstructions(selectedTiers: OutfitTierSlug[], gender?: string | null) {
  return [
    ...buildBaseOutfitRules(gender),
    'Return only structured JSON matching the provided schema.',
    `Return only the requested tier recommendations in this order: ${selectedTiers.join(', ')}.`,
    'Anchor the recommendations to the provided item or image evidence.',
    'If vibe keywords are provided, treat them as a strong creative direction for silhouette, styling references, palette, detailing, and overall attitude while still honoring the selected tier.',
    'If no image is provided, rely only on the text description and profile context.',
    'Do not mention missing information, policy, or the schema in the output.',
    'IMPORTANT — structured piece output: keyPieces, shoes, and accessories must each be objects with display_name (rich human-readable description) and metadata. The metadata.category MUST be one of the exact enum values in the schema — do not invent new categories. Choose the closest match from the enum. metadata.color should be the dominant color (e.g. "Navy", "Stone", "Charcoal"). metadata.formality must match the tier: business → "Formal" or "Refined Casual"; smart-casual → "Smart Casual" or "Refined Casual"; casual → "Casual".',
    'IMPORTANT — anchor deduplication: the anchor item must NOT appear in keyPieces. keyPieces contains only supporting pieces that complement the anchor. If the anchor is a shirt, do not add the same shirt again as a keyPiece top.',
    'IMPORTANT — anchorPiece field: always populate anchorPiece with a structured representation of the anchor item. display_name must match the anchorItem string. metadata.category must be the exact enum value that best fits the anchor (e.g. "Knitwear" for a quarter-zip, "Outerwear" for a bomber, "Trousers" for cargo pants). metadata.color is the dominant color. metadata.formality must match the tier.',
    'IMPORTANT — category assignment reflects item TYPE, not material: a merino wool tie is "Tie", not "Knitwear"; a cashmere pocket square is "Scarf" or "Tie", not "Knitwear"; a leather belt is "Belt"; a silk scarf is "Scarf". Never assign "Knitwear" to accessories just because they contain wool, merino, or cashmere.',
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
  const isFemale = profile?.gender === 'woman';

  return [
    formatProfileContext(profile, vibeOverride),
    isFemale ? buildFemaleStyleFramework() : null,
    isFemale && profile?.bodyType ? buildFemaleBodyTypeGuidance(profile.bodyType) : null,
    isFemale && (profile as any)?.weightDistribution ? buildFemaleWeightDistributionGuidance((profile as any).weightDistribution) : null,
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
  ].filter(Boolean).join('\n');
}

export function buildRegenerateTierInstructions(gender?: string | null) {
  return [
    ...buildBaseOutfitRules(gender),
    gender === 'woman'
      ? 'You are regenerating one tier of a womenswear styling recommendation.'
      : 'You are regenerating one tier of a menswear styling recommendation.',
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
  const isFemale = input.profile?.gender === 'woman';

  return [
    formatProfileContext(input.profile, vibeOverride),
    isFemale ? buildFemaleStyleFramework() : null,
    isFemale && input.profile?.bodyType ? buildFemaleBodyTypeGuidance(input.profile.bodyType) : null,
    isFemale && (input.profile as any)?.weightDistribution ? buildFemaleWeightDistributionGuidance((input.profile as any).weightDistribution) : null,
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
          `- keyPieces: ${previousTier.keyPieces.map((p) => p.display_name).join('; ')}`,
          `- shoes: ${previousTier.shoes.map((p) => p.display_name).join('; ')}`,
          `- accessories: ${previousTier.accessories.map((p) => p.display_name).join('; ')}`,
          `- whyItWorks: ${previousTier.whyItWorks}`,
        ].join('\n')
      : 'There is no previous recommendation for the requested tier.',
    'Return one new recommendation for the requested tier only.',
    'Make the vibe keywords materially visible in the regenerated outfit if they were provided.',
    'Use only the season to shape the styling update. Do not treat current weather details as constraints.',
  ].filter(Boolean).join('\n');
}
