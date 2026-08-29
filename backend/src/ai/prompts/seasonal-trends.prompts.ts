import type { FashionSeason } from '../../modules/seasonal-trends/season-math.js';

export function buildSeasonalTrendsInstructions(): string {
  return [
    'You are the seasonal fashion intelligence engine for a sophisticated personal styling application.',
    'This information will be consumed by an algorithm, not displayed as a fashion article.',
    'Return ONLY valid structured JSON matching the provided schema. No markdown, no commentary, no citations, no explanatory text outside the JSON.',
  ].join(' ');
}

export function buildSeasonalTrendsUserPrompt(input: {
  season: FashionSeason;
  year: number;
  fashionGender: 'menswear' | 'womenswear';
  regionOrLocation: string;
}): string {
  const seasonLabel = input.season === 'fall' ? 'Fall/Autumn' : input.season.charAt(0).toUpperCase() + input.season.slice(1);

  return [
    `Your task is to identify the most important CURRENT ${input.fashionGender} fashion trends for ${seasonLabel} ${input.year} that should influence real-world outfit recommendations.`,
    '',
    `The user is located in: ${input.regionOrLocation}`,
    'If the precise location is a generic fallback rather than a real region, consider mainstream North American fashion trends while incorporating important global influences where they are genuinely affecting mainstream style.',
    '',
    'Prioritize actionable trends that can change: garment selection, silhouettes, fit, proportions, layering, colour combinations, fabrics, textures, footwear, accessories, tailoring, styling combinations.',
    `Focus on trends that are actually relevant during ${seasonLabel} ${input.year}.`,
    '',
    'Avoid: extremely niche runway concepts with little real-world adoption; novelty trends; costume-like styling; microtrends unlikely to survive the season; celebrity-specific looks; vague statements such as "quiet luxury"; generic timeless advice presented as a trend.',
    'You are helping a stylist dress normal people well, not dress someone for Fashion Week.',
    '',
    'Where appropriate, distinguish between an emerging trend, an established/current trend, and a declining trend. Research or reason from the most current fashion information available to you.',
    '',
    'Create separate rankings for:',
    'BUSINESS — professional office dressing, including contemporary corporate environments. The clothes must remain genuinely workplace appropriate.',
    'SMART CASUAL — polished but less formal outfits suitable for restaurants, dates, offices with relaxed dress codes, events, travel, social occasions, and elevated everyday dressing.',
    'CASUAL — everyday dressing including weekends, errands, casual restaurants, travel, social settings and relaxed activities.',
    '',
    'Return exactly 10 ranked trends for EACH category. Do not let the same macro trend simply repeat across all three categories unchanged — explain how it manifests differently at each formality level (e.g. relaxed tailoring reads differently in business vs smart-casual vs casual).',
    'Rank the most influential trend #1 in each category.',
    '',
    'Each trend must contain: rank, name, summary, whyItMattersNow, garmentCategories, silhouettes, colours, materialsOrTextures, footwear, accessories, stylingRules, avoid, trendStrength (1-10 integer, how influential this trend currently is), lifecycle (one of: emerging, current, established, declining), versatility (1-10 integer, how broadly useful for normal users), confidence (0.0-1.0, confidence this is genuinely relevant for the specified season).',
    'stylingRules must be concise, actionable rules an outfit algorithm could apply, e.g. "Prefer wider straight-leg trousers over aggressively slim trousers." or "Pair substantial loafers with fuller trouser silhouettes."',
    'avoid should describe outdated or conflicting styling choices where appropriate, e.g. "overly cropped slim trousers", "certain outdated sneaker silhouettes".',
    '',
    'Do NOT recommend throwing away or excluding someone\'s existing wardrobe simply because something is no longer trending — trends should influence recommendations, not become absolute rules.',
    '',
    `Fill in: season="${input.season}", year=${input.year}, fashionGender="${input.fashionGender}", region="${input.regionOrLocation}", generatedAt=current ISO-8601 timestamp.`,
  ].join('\n');
}
