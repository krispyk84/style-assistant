import type { FashionSeason } from '../../modules/seasonal-trends/season-math.js';
import { SEASONAL_COLOR_COUNT, SKIN_TONE_VALUES } from '../../modules/seasonal-colors/seasonal-colors.schemas.js';

export function buildSeasonalColorsInstructions(fashionGender: 'menswear' | 'womenswear'): string {
  const audience = fashionGender === 'womenswear' ? 'women\'s' : 'men\'s';
  return [
    'You are a seasonal colour intelligence engine for a sophisticated personal styling application.',
    `Your job is to identify the season's most important colours for ${audience} fashion — the hues that are genuinely trending across garments, not a generic "colour of the year" marketing pick.`,
    'For each colour, also give an honest, professional colour-analysis judgement of which skin tones it flatters most — this is real styling guidance a user will rely on, not a formality.',
    'This information will be consumed by an algorithm, not displayed as a fashion article.',
    'Return ONLY valid structured JSON matching the provided schema. No markdown, no commentary, no citations, no explanatory text outside the JSON.',
  ].join(' ');
}

export function buildSeasonalColorsUserPrompt(input: {
  season: FashionSeason;
  year: number;
  fashionGender: 'menswear' | 'womenswear';
  regionOrLocation: string;
}): string {
  const seasonLabel = input.season === 'fall' ? 'Fall/Autumn' : input.season.charAt(0).toUpperCase() + input.season.slice(1);

  return [
    `Your task is to identify the ${SEASONAL_COLOR_COUNT} most important CURRENT ${input.fashionGender} colours for ${seasonLabel} ${input.year} that should influence real-world outfit and colour-palette recommendations.`,
    '',
    `The user is located in: ${input.regionOrLocation}`,
    'If the precise location is a generic fallback rather than a real region, consider mainstream North American fashion trends while incorporating important global influences where they are genuinely affecting mainstream style.',
    '',
    'For each colour provide:',
    '- rank: 1 (most important) through ' + SEASONAL_COLOR_COUNT + ', no duplicates.',
    '- name: an evocative, specific colour name (e.g. "Terracotta Rust", "Sage Moss", "Ecru").',
    '- hex: the single closest-matching 6-digit hex code for this colour (e.g. "#B5502E").',
    '- description: one concise sentence on why this colour is significant this season and how it is typically used (garments, accents, palette pairing).',
    `- bestSuitedSkinTones: which of these skin tones this colour most flatters, as a genuine colour-analysis judgement (list every tone it suits well, at least one, not all six by default) — choose only from: ${SKIN_TONE_VALUES.join(', ')}.`,
    '',
    'Avoid picking colours that are nearly identical to each other — the list should read as a genuinely varied, useful palette.',
    'Do NOT recommend a user discard or avoid colours they already own simply because they are absent from this list — this list is a seasonal bias, not an exclusion rule.',
    '',
    `Fill in: season="${input.season}", year=${input.year}, fashionGender="${input.fashionGender}", region="${input.regionOrLocation}", generatedAt=current ISO-8601 timestamp.`,
  ].join('\n');
}
