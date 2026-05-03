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
    // Bag selection guidance is intentionally NOT injected here. Bags must only be
    // included when the user explicitly opts in via includeBag — see buildOptionalItemsRule.
    // Adding an unconditional bag rule biased the model into always choosing one.
  ].join(' ');
}

/**
 * Trendiness rule — biases recommendations along a safe ↔ trend-forward axis.
 * Value is a 0–100 dial set in app Settings; sent on every generation request.
 * Banded (not interpolated) so the model gets concrete imperatives instead of
 * vague numeric reasoning. Always emits an instruction (including the balanced
 * mid-band) so the model's output is observably different across the range.
 */
function buildTrendinessRule(trendinessRaw: number | undefined | null): string | null {
  if (trendinessRaw === undefined || trendinessRaw === null) return null;
  const t = Math.max(0, Math.min(100, Math.round(trendinessRaw)));

  if (t < 34) {
    return [
      `STYLE TRENDINESS DIAL — user setting: ${t}/100 (SAFE / CLASSIC). This is a HARD styling constraint set by the user; it must visibly shape every recommendation.`,
      '- Lean firmly into timeless wardrobe staples. Favour established silhouettes (regular-rise straight or slim trousers, single-breasted blazers, classic shirt cuts, plain crewnecks, refined leather shoes) and longstanding pieces over current micro-trends.',
      '- Palette: mostly neutrals (navy, charcoal, stone, camel, white, grey, black). Treat saturated colour as an accent at most. Avoid highly seasonal "of-the-moment" colour stories.',
      '- Avoid: exaggerated proportions purely for fashion (extreme oversize, ultra-cropped, balloon volumes), of-the-moment trend pieces, statement logos, ironic/maximalist styling, and pieces that read clearly as "this season".',
      '- Detailing should be quiet — no statement hardware, no bold prints, no novelty silhouettes. The wearer should look "well-dressed" rather than "current".',
      '- Each piece should be wearable largely unchanged in five years.',
      '- The user has explicitly opted out of fashion-forward dressing. If you are about to suggest a directional / trendy / "of-the-moment" piece, replace it with a classic equivalent.',
    ].join('\n');
  }

  if (t <= 66) {
    return [
      `STYLE TRENDINESS DIAL — user setting: ${t}/100 (BALANCED). This is a HARD styling constraint; mix timeless staples with current pieces in a deliberate ratio.`,
      '- Build the bones of each outfit from established, season-flexible pieces (well-cut trousers/jeans, quality knits, classic shirts, refined shoes).',
      '- Layer in ONE clearly current element per outfit — a piece, silhouette detail, colour, or accessory that reads as "of this moment". Not zero. Not three.',
      '- Palette: anchored in neutrals, with room for one current accent or one considered tonal pairing per outfit.',
      '- Avoid both extremes: do NOT default to the safest possible navy/grey/white commuter combo, AND do NOT pile on multiple directional pieces. The wearer should look both put-together and aware.',
    ].join('\n');
  }

  // t > 66
  return [
    `STYLE TRENDINESS DIAL — user setting: ${t}/100 (TRENDY / FASHION-FORWARD). This is a HARD styling constraint set by the user; it must visibly shape every recommendation.`,
    '- Lean into pieces that read as current. Reach for of-the-moment silhouettes, proportions, and detailing — not decade-defining basics.',
    '- Silhouette: explore deliberate proportion play (wider legs with cropped or fitted tops, longline layering, structured shoulders, intentionally long or short hems) where it suits the tier.',
    '- Palette: include current colour stories and unexpected combinations alongside neutrals. A standout accent colour or considered tonal pairing is welcome — outfits should feel composed, not muted.',
    '- Detailing welcome: noticeable hardware, refined statement accessories, distinct textures (raffia, mesh, technical fabric, brushed wool, sheen), considered prints — used with intention, not piled on.',
    '- Aim for outfits that feel current and editorially aware while still respecting the chosen tier (no streetwear in the business tier, no formalwear in casual). The wearer should look "in the moment", not "anytime".',
    '- Avoid pure safe-bet defaults like a navy blazer + white shirt + grey trousers + brown loafer combo unless every other piece is doing something distinctive.',
    '- The user has explicitly opted INTO fashion-forward dressing. If a piece would feel safe or generic, swap it for a more directional alternative.',
  ].join('\n');
}

/**
 * Bag and hat are STRICTLY user-controlled. The model previously had a standing
 * bag-selection rule in instructions, which biased every outfit to include a
 * bag even when the user didn't ask for one. This rule is now the single source
 * of truth for whether a bag/hat appears, and emits both positive and negative
 * imperatives so the model can't silently add one.
 *
 * When includeBag is true: bag is mandatory, must be laptop-capable, must be
 * tier-appropriate. Small purse/clutch/mini silhouettes are forbidden.
 *
 * When includeBag is false: NO bag may appear in accessories — explicit
 * prohibition with category-name reference so the model can self-check.
 *
 * Same applies to hat.
 */
function buildOptionalItemsRule(opts: { includeBag: boolean; includeHat: boolean; gender?: string | null }): string {
  const isMens = opts.gender !== 'woman';
  const lines: string[] = ['USER-CONTROLLED ACCESSORY INCLUSIONS — these are HARD constraints set by the user; you must obey them exactly:'];

  // ── BAG ────────────────────────────────────────────────────────────────────
  if (opts.includeBag) {
    const mensBagBias = isMens
      ? 'For menswear, prefer briefcase, structured work tote, leather messenger, large shoulder bag, weekender, holdall, or backpack with laptop sleeve. Do NOT use clutches, top-handle handbags, hobo bags, or other purse-scale silhouettes.'
      : 'For womenswear, prefer structured work tote, briefcase, large shoulder bag, structured satchel, large top-handle, or backpack — all sized to fit a 13–16" laptop. Do NOT use clutches, mini bags, micro-bags, evening bags, or any tiny "it-bag" silhouette.';
    lines.push(
      [
        '- BAG: REQUIRED. Include exactly one bag in accessories with metadata.category = "Bag".',
        'SIZE REQUIREMENT (non-negotiable): the bag must be large enough to comfortably carry a 13–16-inch laptop computer plus everyday work items. This is a HARD floor on size — DO NOT recommend small purse-sized bags, micro bags, mini bags, clutches, evening bags, belt bags, fanny packs, slings under laptop capacity, or any "it-bag" / accessory-purse silhouette. The bag must be functional and proportionate to a person carrying a laptop, not a fashion accessory of decorative size.',
        'TYPE GUIDANCE by tier:',
        '  • business → briefcase, slim leather attaché, structured leather work tote, refined leather laptop messenger, or hard-sided portfolio bag. Never a small handbag.',
        '  • smart-casual → structured work tote, leather messenger, large leather shoulder bag, refined leather backpack with laptop sleeve, or large soft tote in an elevated material.',
        '  • casual → backpack with laptop sleeve, daypack, large canvas or leather tote, oversized shoulder bag, or messenger. Casual still requires laptop-capacity sizing.',
        mensBagBias,
        'Do NOT default to a generic "canvas tote" — pick a deliberate bag type with specified color and material (e.g. "Tan grained-leather briefcase", "Black nylon laptop backpack", "Espresso leather work tote large enough for a 15-inch laptop").',
        'When the anchor metadata indicates the outfit already includes a bag, build around that bag rather than introducing a different one — but only if that bag also meets the laptop-capacity requirement.',
      ].join(' ')
    );
  } else {
    lines.push(
      [
        '- BAG: FORBIDDEN. The user did NOT opt to include a bag. accessories MUST NOT contain any item with metadata.category = "Bag".',
        'Do not add bags, totes, briefcases, backpacks, messengers, clutches, satchels, crossbodies, slings, weekenders, holdalls, belt bags, fanny packs, or any other carrying piece — regardless of how complete the look would feel with one.',
        'If you find yourself reaching for a bag because the outfit "needs one", choose a different accessory category instead (Belt, Watch, Sunglasses, Scarf, Tie, Socks).',
      ].join(' ')
    );
  }

  // ── HAT ────────────────────────────────────────────────────────────────────
  if (opts.includeHat) {
    const mensHatExamples = 'baseball cap, beanie, wool flat cap, fedora-style hat, panama, bucket hat, structured wide-brim, or knit watch cap';
    const womensHatExamples = 'baseball cap, beanie, wide-brim straw or felt hat, bucket hat, fedora-style hat, panama, beret, or knit watch cap';
    lines.push(
      `- HAT: REQUIRED. Include exactly one hat in accessories with metadata.category = "Hat", chosen so it reinforces the outfit's tier and styling direction. Choose the hat TYPE deliberately from options like ${isMens ? mensHatExamples : womensHatExamples}. The hat must not clash with the tier (no baseball cap on a formal-business look, no fedora on activewear). Specify color and material (e.g. "Charcoal wool flat cap", "Black ribbed-knit beanie", "Camel wide-brim wool felt hat", "Stone canvas baseball cap").`
    );
  } else {
    lines.push(
      [
        '- HAT: FORBIDDEN. The user did NOT opt to include a hat. accessories MUST NOT contain any item with metadata.category = "Hat".',
        'Do not add caps, beanies, fedoras, panamas, berets, bucket hats, sun hats, or any headwear of any kind — regardless of season or styling logic.',
      ].join(' ')
    );
  }

  lines.push(
    'These bag and hat constraints are HARD constraints set explicitly by the user and OVERRIDE any styling instinct, tier guidance, "complete look" reasoning, or seasonal logic. Re-read this rule before finalizing accessories — if any item violates the constraints above, replace it with one in a different category.'
  );
  return lines.join('\n');
}

function buildSeasonInstruction(season: string, isManual: boolean): string {
  const seasonGuide: Record<string, string> = {
    summer: 'Hot-weather styling: lightweight fabrics (linen, cotton, breathable blends), minimal layering, no heavy jackets, coats, wool layers, sweaters, chunky knits, or cold-weather outerwear unless the user specifically requested them.',
    spring: 'Mild transitional styling: light layers, transitional fabrics, breathable mid-weight pieces. Avoid heavy winter coats or thick knits.',
    fall:   'Cool transitional styling: medium-weight layers, autumnal textures and tones. Light-to-medium outerwear appropriate. Avoid summer-only lightweight pieces.',
    winter: 'Cold-weather styling: warm layering, heavier fabrics (wool, cashmere, flannel), appropriate outerwear and knits. Embrace cold-weather pieces.',
  };
  const guide = seasonGuide[season] ?? 'Style appropriately for the season.';

  if (isManual) {
    return [
      `SEASON OVERRIDE — USER EXPLICITLY SELECTED: ${season.toUpperCase()}`,
      `The user has manually chosen "${season}" as the styling season for this request. This is the PRIMARY styling constraint and takes full precedence over any weather data, temperature values, or climate inferences.`,
      `Treat this as: ${guide}`,
      'Do NOT introduce cold-weather pieces for a summer selection or warm-weather-only pieces for a winter selection based on weather data. The user\'s season choice is authoritative.',
    ].join('\n');
  }

  return `- currentSeason: ${season} (weather-derived — ${guide})`;
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

  const effectiveSeason = input.manualSeason || input.weatherContext?.season || null;
  const isManualSeason = Boolean(input.manualSeason);

  return [
    formatProfileContext(profile, vibeOverride),
    isFemale ? buildFemaleStyleFramework() : null,
    isFemale && profile?.bodyType ? buildFemaleBodyTypeGuidance(profile.bodyType) : null,
    isFemale && (profile as any)?.weightDistribution ? buildFemaleWeightDistributionGuidance((profile as any).weightDistribution) : null,
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    isManualSeason && effectiveSeason ? buildSeasonInstruction(effectiveSeason, true) : null,
    buildOptionalItemsRule({ includeBag: !!input.includeBag, includeHat: !!input.includeHat, gender: profile?.gender }),
    buildTrendinessRule(input.trendiness),
    'Styling request:',
    ...anchorItems.map(
      (item, index) =>
        `- anchorItem ${index + 1}: ${item.description.trim() || 'No text description provided.'} | hasImage: ${Boolean(item.imageId || item.imageUrl)}`
    ),
    input.vibeKeywords?.trim() ? `- vibeKeywords: ${input.vibeKeywords.trim()}` : '- vibeKeywords: none provided',
    `- selectedTiersFromClient: ${input.selectedTiers.join(', ')}`,
    `- photoPending: ${String(input.photoPending)}`,
    !isManualSeason && effectiveSeason
      ? buildSeasonInstruction(effectiveSeason, false)
      : !isManualSeason
        ? '- currentSeason: unavailable'
        : null,
    `Return recommendations only for: ${input.selectedTiers.join(', ')}.`,
    'Each recommendation should include a specific title, anchor item wording, key pieces, shoes, accessories, fit notes, why it works, styling direction, and detail notes.',
    'When vibe keywords are present, visibly reflect them in the recommendations instead of treating them as secondary decoration.',
    isManualSeason
      ? 'The season is user-selected and is the single authoritative styling constraint. Do not let any weather data or temperature inference override it.'
      : 'Use only the season to influence fabric weight, layering, palette, and overall styling direction. Do not infer extra constraints from current weather conditions.',
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
    // Bag rule is conditional — see buildOptionalItemsRule applied in the user prompt.
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
    buildOptionalItemsRule({
      includeBag: !!input.existing.input.includeBag,
      includeHat: !!input.existing.input.includeHat,
      gender: input.profile?.gender,
    }),
    buildTrendinessRule(input.existing.input.trendiness),
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
    (() => {
      const manualSeason = input.existing.input.manualSeason;
      const weatherSeason = input.existing.input.weatherContext?.season;
      const effectiveSeason = manualSeason || weatherSeason || null;
      if (!effectiveSeason) return '- currentSeason: unavailable';
      return buildSeasonInstruction(effectiveSeason, Boolean(manualSeason));
    })(),
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
    input.existing.input.manualSeason
      ? 'The season is user-selected — it is the authoritative styling constraint. Do not override it with weather-based reasoning.'
      : 'Use only the season to shape the styling update. Do not treat current weather details as constraints.',
  ].filter(Boolean).join('\n');
}
