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
  business:
    'Business — polished, professional pieces appropriate for an office or client-facing setting. ' +
    'Tailored trousers or suiting, collared shirts, structured blazers or sport coats, smart knitwear, refined leather shoes. ' +
    'NEVER: sneakers, denim, shorts, t-shirts, resort/vacation pieces, drawstring or elastic-waist trousers, sandals, espadrilles, graphic prints, gym wear.',
  'smart-casual':
    'Smart Casual — elevated and put-together, but NOT businesswear and NOT resort/vacation wear. ' +
    'Chinos, dark refined denim, knit polos, oxford or button-down shirts, blazers or unstructured jackets worn over a knit, clean leather sneakers, loafers, or boots. ' +
    'NEVER: camp-collar or Cuban-collar shirts, linen drawstring or pleated resort trousers, espadrilles, swim-adjacent fabrics or prints, gym/athletic wear, ripped or heavily distressed denim, shorts, flip-flops or slides. ' +
    'If a piece reads as "vacation" or "resort" rather than "put-together everyday", it does not belong in a smart-casual outfit.',
  casual:
    'Casual — relaxed and comfortable, for everyday wear or weekend downtime. T-shirts, henleys, hoodies, jeans, joggers, sneakers. ' +
    'Resort and vacation pieces (camp-collar shirts, linen drawstring trousers, espadrilles) are acceptable here if the wardrobe and weather call for them. ' +
    'Still intentional and well put-together, never sloppy.',
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
    'HARD RULES (in priority order — earlier rules override later ones if they ever conflict):',
    '1. COMPLETENESS IS NON-NEGOTIABLE: every outfit MUST include a bottom (trousers/denim/shorts, or a suit/jumpsuit that covers the lower body) AND footwear (shoes/sneakers/loafers/boots), in addition to a top. An outfit missing a bottom or footwear is an invalid, unusable answer — always fill these slots from the wardrobe index before adding anything else.',
    '2. Every item you use MUST be referenced by its exact "id" from the wardrobe index provided in the user message. Never invent an item or use an id that is not in the index.',
    '3. FORMALITY IS A HARD CONSTRAINT, not a suggestion. The requested formality level overrides trendiness whenever they would otherwise conflict — never include a piece that violates the formality band just because it is trendy or directional. Each wardrobe item may also carry its own "formality" tag from cataloguing; treat that as a strong signal and avoid building a smart-casual or business outfit primarily from items tagged casual.',
    '4. COLOR COORDINATION: do not put 3 or more pieces in the same color/color-family in one outfit (e.g. olive top + olive trousers + olive shoes) — head-to-toe monochrome reads as flat and lifeless, not stylish, even at high trendiness. Build real contrast: pair a colored piece against neutrals (white, black, navy, grey, stone, tan/camel), or use at most one secondary color alongside a neutral base.',
    '5. Never put two items from the same competing slot in one outfit (e.g. two pairs of trousers, two jackets meant to be worn alone).',
    '6. Return exactly 5 outfits, and make them meaningfully different from each other — vary the anchor piece, colour story, and silhouette across the 5. Do not return near-duplicates.',
    '7. VARIETY ACROSS REQUESTS: this client has a large wardrobe. If the user message lists "Recently featured items", deliberately minimise reusing them here — actively draw on other pieces from the index that still satisfy every rule above, rather than defaulting to the same "obvious" combination every time. Only reuse a recently-featured item when the wardrobe genuinely does not offer a suitable alternative for that slot.',
    '8. PREFERENCE SIGNAL: if the user message lists items the client has loved or hated in past outfits, lean toward the loved items and the styles they represent where they fit the brief, and avoid the hated items where a reasonable alternative exists — but never let this override rules 1-6.',
    '9. Within all of the above constraints, look cool, current, and intentional — this is a client who cares about their aesthetic, not a rote uniform.',
    '',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export type ClosetOutfitVarietyContext = {
  /** Item ids featured in this client's recent generations — deprioritise, don't hard-exclude. */
  recentlyUsedItems?: { id: string; name: string }[];
  /** Item ids from outfits this client explicitly loved/hated. */
  preference?: { loved: { id: string; name: string }[]; hated: { id: string; name: string }[] };
};

function buildVarietyAndPreferenceBlock(context?: ClosetOutfitVarietyContext): string | null {
  if (!context) return null;
  const lines: string[] = [];

  if (context.recentlyUsedItems?.length) {
    lines.push(
      'Recently featured items (used in outfits generated for this client recently — minimise reuse per rule 7):',
      context.recentlyUsedItems.map((item) => `- ${item.name} (${item.id})`).join('\n'),
    );
  }
  if (context.preference?.loved.length) {
    lines.push(
      'Loved in past outfits (lean into these where they fit the brief, per rule 8):',
      context.preference.loved.map((item) => `- ${item.name} (${item.id})`).join('\n'),
    );
  }
  if (context.preference?.hated.length) {
    lines.push(
      'Disliked in past outfits (avoid where a reasonable alternative exists, per rule 8):',
      context.preference.hated.map((item) => `- ${item.name} (${item.id})`).join('\n'),
    );
  }

  return lines.length ? lines.join('\n') : null;
}

function buildContextBlock(params: {
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  trendiness?: number | null;
  variety?: ClosetOutfitVarietyContext;
}): string {
  const lines = [
    `Formality: ${FORMALITY_GUIDE[params.formality] ?? params.formality}`,
    params.season && SEASON_GUIDE[params.season] ? `Season: ${SEASON_GUIDE[params.season]}` : null,
    params.weatherSummary ? `Current weather: ${params.weatherSummary}` : null,
    params.weatherStylingHint ? `Weather styling guidance: ${params.weatherStylingHint}` : null,
    buildTrendinessRule(params.trendiness),
    buildVarietyAndPreferenceBlock(params.variety),
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
  variety?: ClosetOutfitVarietyContext;
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
  swapItemIds: string[];
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  trendiness?: number | null;
  variety?: ClosetOutfitVarietyContext;
}): string {
  const keepItemIds = params.baseItemIds.filter((id) => !params.swapItemIds.includes(id));
  const indexById = new Map(params.index.map((item) => [item.id, item]));
  const describe = (id: string) => {
    const item = indexById.get(id);
    return item ? `${item.name} (${id})` : id;
  };

  return [
    buildContextBlock(params),
    '',
    'Wardrobe index (every item you may use — reference by exact id):',
    JSON.stringify(params.index, null, 2),
    '',
    `Base outfit (item ids): ${JSON.stringify(params.baseItemIds)}`,
    '',
    'The client has told you exactly what to change — this is not your choice to make:',
    `- KEEP UNCHANGED in every variation, exactly as in the base outfit: ${keepItemIds.map(describe).join(', ') || '(none)'}`,
    `- REPLACE in every variation, each with a different item from the wardrobe index: ${params.swapItemIds.map(describe).join(', ')}`,
    '',
    'Build exactly 5 variations of the base outfit. For each variation:',
    '- Every "keep unchanged" item id above MUST appear in the variation\'s item list, unmodified. This is a hard requirement — a variation missing one of them is an invalid answer.',
    '- Every "replace" item above MUST be swapped for a different item from the wardrobe index that fills the same role (e.g. a different top for a top, a different shoe for a shoe) and still satisfies the formality/completeness/color rules with the kept items.',
    '- Do not touch any item that is not explicitly listed as "replace" above.',
    '- Across the 5 variations, use a different replacement each time where the wardrobe offers enough alternatives for that slot — don\'t repeat the same replacement item twice unless the wardrobe genuinely has no other option.',
    'For each variation return: a short title, the full list of item ids used (including the unchanged ones), and one sentence on why the swap works.',
  ].join('\n');
}
