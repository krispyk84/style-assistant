import { HAIRCUT_TREND_STYLE_COUNT } from '../../modules/haircut-trends/haircut-trends.schemas.js';

export function buildHaircutTrendsInstructions(): string {
  return [
    'You are a hairstyling trend intelligence engine for a personal style app.',
    'Your job is to identify the current season\'s most relevant haircuts — a mix of what is genuinely trending right now AND enduring classic cuts that remain in steady demand at barbershops and salons.',
    'Prioritize styles that are actionable for an AI photo-editing tool to render on a real headshot: describe length, texture, fade/taper type, parting, and finish concretely rather than vaguely.',
    'Avoid one-off runway/editorial looks, costume-like styles, or anything that would look strange on an everyday person walking into a barbershop or salon.',
    'Return ONLY valid JSON matching the provided schema. No markdown, no commentary outside the JSON.',
  ].join('\n');
}

export function buildHaircutTrendsUserPrompt(input: { season: string; year: number; regionOrLocation: string }): string {
  return [
    `Season: ${input.season} ${input.year}`,
    `Region/location context: ${input.regionOrLocation}`,
    '',
    `Produce exactly ${HAIRCUT_TREND_STYLE_COUNT} haircuts for this season.`,
    'This list must be a well-balanced MIX — do not make it skew entirely toward edgy or directional cuts:',
    '- At least 5 entries should be classification "trending": current, of-the-moment cuts that are gaining popularity right now.',
    '- At least 5 entries should be classification "classic": timeless, enduringly popular cuts that remain reliably in-demand regardless of season (e.g. classic side parts, crew cuts, buzz cuts) — these should NOT be filler, pick genuinely well-regarded classics.',
    '- The remaining entries can be either, whichever best represents the season\'s actual landscape.',
    'Cover a broad range of hair types, lengths, and textures (straight, wavy, curly, coily/afro-textured) and a range of maintenance levels (low-maintenance to more involved styling) so the list is broadly useful, not narrow.',
    'For each style provide:',
    '- key: a short kebab-case slug uniquely identifying the style (e.g. "textured-quiff").',
    '- label: a clean display name (e.g. "Textured Quiff").',
    '- summary: one concise, concrete sentence describing the cut — this exact sentence will be used to instruct an AI photo editor to render the cut on a real photo, so be specific about length, texture, fade/taper, and finish.',
    '- classification: "classic" or "trending".',
    'Every style must be distinct — no duplicate or near-duplicate cuts under different names.',
    'Also return: season (the season name as given above), year (as given above), region (the region/location context as given above, or "Unknown" if not meaningfully specific), and generatedAt (current ISO 8601 timestamp).',
  ].join('\n');
}
