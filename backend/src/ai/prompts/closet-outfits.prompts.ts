// Prompt construction for the "Generate 5 Outfits" closet feature.
// Unlike outfits.prompts.ts (which lets the model invent pieces, matched to the
// closet client-side afterward), these prompts hand the model the FULL wardrobe
// index up front and require every returned outfit to be built entirely from
// those item ids — no invented pieces.

export type ClosetOutfitIndexItem = {
  id: string;
  name: string;
  category: string;
  color_family?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  material?: string | null;
  brand?: string | null;
};

const SEASON_GUIDE: Record<string, string> = {
  spring: 'Spring (mild transitional weather) — favour lighter fabrics and transitional layering pieces.',
  summer: 'Summer (hot weather) — favour lightweight breathable pieces; avoid heavy knits, thick outerwear, or winter-weight fabrics.',
  fall: 'Fall (cool transitional weather) — favour medium-weight layers and autumnal textures.',
  winter: 'Winter (cold weather) — favour warm fabrics, heavier knits, and appropriate outerwear.',
};

const FORMALITY_GUIDE: Record<string, string> = {
  business: 'Business — polished, professional pieces appropriate for an office or client-facing setting. Tailored fits, structured pieces, refined footwear.',
  'smart-casual': 'Smart Casual — put-together but relaxed. Elevated everyday pieces; a blazer or knit can pair with refined denim or chinos.',
  casual: 'Casual — relaxed, comfortable, everyday pieces. Still intentional and well put-together, never sloppy.',
};

function buildTrendinessRule(trendinessRaw: number | undefined | null): string | null {
  if (trendinessRaw === undefined || trendinessRaw === null) return null;
  const t = Math.max(0, Math.min(100, Math.round(trendinessRaw)));

  if (t < 34) {
    return `TRENDINESS ${t}/100 (CLASSIC): favour timeless, safe combinations from the wardrobe. Avoid anything that reads as a fleeting micro-trend.`;
  }
  if (t <= 66) {
    return `TRENDINESS ${t}/100 (BALANCED): build mostly from timeless pieces, but let at least one outfit lean into a current, of-the-moment combination if the wardrobe supports it.`;
  }
  return `TRENDINESS ${t}/100 (TRENDY): favour current, fashion-forward combinations. Prioritise the wardrobe's most directional pieces and unexpected pairings — the wearer wants to look current, not safe.`;
}

export function buildClosetOutfitsSystemPrompt(): string {
  return [
    'You are an expert personal stylist assembling complete, wearable outfits entirely from a client\'s existing wardrobe.',
    '',
    'HARD RULES:',
    '- Every item you use MUST be referenced by its exact "id" from the wardrobe index provided in the user message. Never invent an item or use an id that is not in the index.',
    '- Each outfit must be a complete, coherent, wearable look: at minimum a top + bottom (or a single-piece equivalent such as a jumpsuit or suit) plus footwear. Add outerwear or accessories only when the wardrobe has an appropriate piece and the look benefits from it.',
    '- Never put two items from the same competing slot in one outfit (e.g. two pairs of trousers, two jackets meant to be worn alone).',
    '- Return exactly 5 outfits, and make them meaningfully different from each other — vary the anchor piece, colour story, and silhouette across the 5. Do not return near-duplicates.',
    '- Look cool, current, and intentional — this is a client who cares about their aesthetic, not a rote uniform.',
    '',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

function buildContextBlock(params: {
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  trendiness?: number | null;
}): string {
  const lines = [
    `Formality: ${FORMALITY_GUIDE[params.formality] ?? params.formality}`,
    params.season && SEASON_GUIDE[params.season] ? `Season: ${SEASON_GUIDE[params.season]}` : null,
    params.weatherSummary ? `Current weather: ${params.weatherSummary}` : null,
    params.weatherStylingHint ? `Weather styling guidance: ${params.weatherStylingHint}` : null,
    buildTrendinessRule(params.trendiness),
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

export function buildClosetOutfitsUserPrompt(params: {
  index: ClosetOutfitIndexItem[];
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  trendiness?: number | null;
}): string {
  return [
    buildContextBlock(params),
    '',
    'Wardrobe index (every item you may use — reference by exact id):',
    JSON.stringify(params.index, null, 2),
    '',
    'Build exactly 5 distinct, complete outfits from this wardrobe for the formality and weather context above.',
    'For each outfit return: a short title, the list of item ids used, and one sentence on why it works.',
  ].join('\n');
}

export function buildClosetOutfitVariationsUserPrompt(params: {
  index: ClosetOutfitIndexItem[];
  baseItemIds: string[];
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  trendiness?: number | null;
}): string {
  return [
    buildContextBlock(params),
    '',
    'Wardrobe index (every item you may use — reference by exact id):',
    JSON.stringify(params.index, null, 2),
    '',
    `Base outfit (item ids): ${JSON.stringify(params.baseItemIds)}`,
    '',
    'Build exactly 5 variations of the base outfit above. For each variation:',
    '- Keep MOST of the base outfit\'s items unchanged.',
    '- Swap exactly 1 or 2 items for a different item from the wardrobe index (e.g. a different top, a different pair of shoes, or add/remove one accessory) — never swap every item, and never return the base outfit unchanged.',
    '- Each of the 5 variations must be distinct from the base outfit AND from each other — do not repeat the same swap twice.',
    'For each variation return: a short title, the full list of item ids used (including the unchanged ones), and one sentence on why the swap works.',
  ].join('\n');
}
