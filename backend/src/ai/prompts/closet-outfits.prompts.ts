// Prompt construction for the "Generate 5 Outfits" closet feature.
// Item selection is shortlist-constrained, not free-invention: each slot
// (footwear, bottoms, tops, ...) is pre-filtered to real, formality-
// appropriate closet items (closet-outfit-builder.ts's
// buildOutfitSlotShortlists) before the model ever sees it, and the response
// schema's per-slot id fields are JSON-schema `enum`s of exactly those real
// ids — so the model CANNOT return a wrong-formality or invented piece, but
// still makes the actual color/texture/silhouette/vibe choice and writes the
// narrative fields. This is what fixes formality mismatches and phantom
// pieces while keeping real styling judgment intact.
// ClosetOutfitIndexItem/ClosetOutfitSeasonalTrendsContext are still shared with
// outfits.prompts.ts (Create a Look's closet-only path) and closet-index.ts.

import type { TrendFeedbackValue } from '../../modules/seasonal-trends/trend-feedback.repository.js';
import { buildSeasonalTrendGuidance } from './seasonal-trend-guidance.js';

export type ClosetOutfitSeasonalTrendsContext = {
  profile: { business: unknown; smartCasual: unknown; casual: unknown };
  isStale: boolean;
  feedbackMap?: Map<string, TrendFeedbackValue> | null;
};

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

// Calendar season is a weak, date-derived signal — an early-fall heatwave or a
// late-spring cold snap should not dress the client for the wrong weather.
// Actual current temperature is the authoritative signal for fabric weight
// and outerwear; season (below) is demoted to palette/mood only.
function buildTemperatureRule(temperatureC?: number | null): string | null {
  if (temperatureC == null) return null;
  const t = Math.round(temperatureC);
  if (t >= 24) {
    return `TEMPERATURE (currently feels like ${t}°C): HOT. This takes priority over the calendar season below whenever they'd conflict. Use ONLY lightweight, breathable fabrics (linen, cotton, jersey, poplin, lightweight knits). Absolutely NO coats, wool sweaters, heavy knitwear, suede jackets, or thick layers — even if the season is generally associated with cooler weather.`;
  }
  if (t >= 18) {
    return `TEMPERATURE (currently feels like ${t}°C): WARM. This takes priority over the calendar season below whenever they'd conflict. Light-to-medium fabrics preferred; a light jacket, unlined blazer, or overshirt is the maximum outerwear — no heavy coats, wool, or suede outerwear.`;
  }
  if (t >= 10) {
    return `TEMPERATURE (currently feels like ${t}°C): MILD-COOL. Medium-weight layers acceptable; a jacket or light coat is fine. No heavy parkas or extreme cold-weather gear.`;
  }
  return `TEMPERATURE (currently feels like ${t}°C): COLD. Warm layers, coats, and knitwear are appropriate.`;
}

const WET_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_WEATHER_CODES = new Set([71, 73, 75, 77, 85, 86]);

function buildPrecipitationRule(weatherCode?: number | null): string | null {
  if (weatherCode == null) return null;
  if (WET_WEATHER_CODES.has(weatherCode)) {
    return 'PRECIPITATION: it is currently rainy/wet. Avoid suede and unfinished/untreated leather anywhere in the outfit (shoes, jackets, bags) — they stain and water-mark in rain. Prefer treated leather, canvas, technical, or synthetic materials, and favour closed, weather-appropriate footwear over open or delicate options.';
  }
  if (SNOW_WEATHER_CODES.has(weatherCode)) {
    return 'PRECIPITATION: it is currently snowy. Avoid suede and unfinished/untreated leather anywhere in the outfit (shoes, jackets, bags) — they stain and water-mark in snow. Favour weatherproof outerwear and footwear with good traction and water resistance.';
  }
  return null;
}

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

/**
 * Free-form additional guidance from the user — appended as a HARD styling
 * constraint so the model treats it as a steering signal rather than a hint.
 * Mirrors buildAdditionalDetailsRule in outfits.prompts.ts (the tiered-outfit
 * flow's equivalent field).
 */
function buildAdditionalDetailsRule(additionalDetails: string | undefined | null): string | null {
  const trimmed = additionalDetails?.trim();
  if (!trimmed) return null;
  return [
    'ADDITIONAL USER DETAILS — these are user-supplied directives. Treat them as a HARD styling constraint that must visibly shape every outfit; do not ignore, dilute, or summarise them away:',
    `"${trimmed}"`,
    'If the directive conflicts with a styling instinct, follow the directive. If it specifies a context (occasion, audience, activity), let it inform which wardrobe items you select and how formal/relaxed the styling reads within the requested formality band. If it forbids a piece, color, or feel, do not select anything from the wardrobe index that violates it.',
  ].join('\n');
}

function buildSeasonalFashionTrendsRule(
  formality: string,
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null,
): string | null {
  if (!seasonalTrends) return null;
  return buildSeasonalTrendGuidance({
    profile: seasonalTrends.profile,
    formality: formality as 'business' | 'smart-casual' | 'casual',
    isStale: seasonalTrends.isStale,
    feedbackMap: seasonalTrends.feedbackMap,
  });
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
      'Recently featured items (used in outfits generated for this client recently — minimise reuse per the variety rule):',
      context.recentlyUsedItems.map((item) => `- ${item.name} (${item.id})`).join('\n'),
    );
  }
  if (context.preference?.loved.length) {
    lines.push(
      'Loved in past outfits (lean into these where they fit the brief):',
      context.preference.loved.map((item) => `- ${item.name} (${item.id})`).join('\n'),
    );
  }
  if (context.preference?.hated.length) {
    lines.push(
      'Disliked in past outfits (avoid where a reasonable alternative exists):',
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
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
  variety?: ClosetOutfitVarietyContext;
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null;
}): string {
  const lines = [
    `Formality: ${FORMALITY_GUIDE[params.formality] ?? params.formality}`,
    buildTemperatureRule(params.temperatureC),
    buildPrecipitationRule(params.weatherCode),
    params.season && SEASON_GUIDE[params.season]
      ? `Season (for palette/mood only — the actual current temperature above takes priority for fabric weight and outerwear): ${SEASON_GUIDE[params.season]}`
      : null,
    params.weatherSummary ? `Current weather: ${params.weatherSummary}` : null,
    params.weatherStylingHint ? `Weather styling guidance: ${params.weatherStylingHint}` : null,
    buildTrendinessRule(params.trendiness),
    buildAdditionalDetailsRule(params.additionalDetails),
    buildSeasonalFashionTrendsRule(params.formality, params.seasonalTrends),
    buildVarietyAndPreferenceBlock(params.variety),
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

// ── Choice + narrate (shortlist-constrained selection) ────────────────────────
// Each slot's shortlist is real, formality-appropriate closet items only —
// the model picks exactly one id per listed slot (schema-enforced via enum)
// and writes the title/rationale, reasoning over color/texture/silhouette/
// vibe using the full item metadata it's given.

export type ClosetOutfitSlotShortlists = Partial<Record<string, ClosetOutfitIndexItem[]>>;

function buildShortlistBlock(shortlists: ClosetOutfitSlotShortlists, heading: string): string {
  const lines: string[] = [heading];
  for (const [slot, items] of Object.entries(shortlists)) {
    if (!items?.length) continue;
    lines.push(`\n${slot.toUpperCase()} options (choose exactly one id):`, JSON.stringify(items, null, 2));
  }
  return lines.join('\n');
}

export function buildClosetOutfitsChoiceSystemPrompt(): string {
  return [
    'You are an expert personal stylist assembling complete, wearable outfits entirely from a client\'s existing wardrobe.',
    '',
    'Each slot below already lists ONLY real, formality-appropriate items from the client\'s closet — you must choose exactly one id per slot listed for each outfit (the schema enforces this: you cannot invent an id or return one that is not listed).',
    '',
    'HARD RULES (in priority order):',
    '1. COLOR COORDINATION: do not choose 3 or more pieces in the same color/color-family for one outfit (e.g. olive top + olive trousers + olive shoes) — head-to-toe monochrome reads as flat, not stylish. Build real contrast: pair a colored piece against neutrals (white, black, navy, grey, stone, tan/camel), or use at most one secondary color alongside a neutral base.',
    '2. TEXTURE & SILHOUETTE: use each item\'s material/silhouette metadata to create intentional contrast and balance — don\'t pair two heavy-textured pieces or stack two oversized silhouettes without reason. A thoughtfully assembled outfit, not a random draw.',
    '3. Choose exactly 5 outfits, and make them meaningfully different from each other — vary the anchor piece, colour story, and silhouette across the 5. Do not return near-duplicate combinations.',
    '4. VARIETY ACROSS REQUESTS: if the user message lists "Recently featured items", deliberately minimise reusing them — actively draw on other pieces from the shortlists that still satisfy every rule above, rather than defaulting to the same "obvious" combination every time. Only reuse a recently-featured item when the shortlist genuinely offers no suitable alternative for that slot.',
    '5. PREFERENCE SIGNAL: if the user message lists items the client has loved or hated in past outfits, lean toward the loved items and the styles they represent where they fit the brief, and avoid the hated items where a reasonable alternative exists — but never let this override rules 1-3.',
    '6. Within all of the above, look cool, current, and intentional — this is a client who cares about their aesthetic, not a rote uniform.',
    '',
    'For each outfit, also write a short evocative title and one sentence on why the combination works — reference the actual chosen pieces, not generic praise.',
    '',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export function buildClosetOutfitsChoiceUserPrompt(params: {
  shortlists: ClosetOutfitSlotShortlists;
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
  variety?: ClosetOutfitVarietyContext;
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null;
}): string {
  return [
    buildContextBlock(params),
    '',
    buildShortlistBlock(params.shortlists, 'WARDROBE OPTIONS BY SLOT:'),
    '',
    'Build exactly 5 distinct, complete outfits from these options for the formality and weather context above.',
  ].join('\n');
}

export function buildClosetOutfitVariationsChoiceUserPrompt(params: {
  keepItems: ClosetOutfitIndexItem[];
  swapShortlists: ClosetOutfitSlotShortlists;
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
  variety?: ClosetOutfitVarietyContext;
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null;
}): string {
  return [
    buildContextBlock(params),
    '',
    'KEEP UNCHANGED in every variant, exactly as listed (do not re-describe or replace):',
    JSON.stringify(params.keepItems, null, 2),
    '',
    buildShortlistBlock(params.swapShortlists, 'REPLACE each of these slots with exactly one id from its own list below — choose thoughtfully so the replacement coordinates with the kept pieces above (color, texture, silhouette):'),
    '',
    'Build up to 5 distinct variants, each swapping in a genuinely different, well-coordinated replacement — do not repeat the same replacement across variants unless the options genuinely run out.',
  ].join('\n');
}
