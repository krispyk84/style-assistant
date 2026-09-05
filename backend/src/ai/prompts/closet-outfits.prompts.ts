// Prompt construction for the "Generate 5 Outfits" closet feature.
// Item SELECTION is deterministic and code-driven (closet-outfit-builder.ts) —
// these prompts only narrate an already-fixed set of real items (title +
// rationale), which is what actually guarantees formality-correctness and
// eliminates phantom pieces, rather than relying on prompt instructions alone.
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

function buildContextBlock(params: {
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
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
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

// ── Narration (item selection is deterministic — code picks the real items,
// the model only writes the title/rationale for an already-fixed set) ────────

export type ClosetOutfitNarrationItem = {
  id: string;
  name: string;
  category: string;
  color_family?: string | null;
  formality?: string | null;
};

export type ClosetOutfitToNarrate = {
  index: number;
  items: ClosetOutfitNarrationItem[];
};

export function buildClosetOutfitNarrationSystemPrompt(): string {
  return [
    'You are an expert personal stylist. For each outfit below, the exact real pieces have ALREADY been chosen for the client from their own closet — your only job is to name it and explain why it works.',
    '',
    'HARD RULES:',
    '1. Do not add, remove, or substitute any piece. Describe only the items listed for each outfit — never invent or imply a piece that is not in that outfit\'s list.',
    '2. Every outfit needs a short, evocative title (2-5 words) — vary the tone/vocabulary across outfits so they don\'t all sound the same.',
    '3. "whyItWorks" is one sentence, specific to the actual pieces listed (reference them by name, not generically) — explain the styling logic (formality fit, color pairing, silhouette, weather-appropriateness), not a generic compliment.',
    '4. Return one entry per outfit index provided, matched by "index". Do not skip or reorder.',
    '',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export function buildClosetOutfitNarrationUserPrompt(params: {
  outfits: ClosetOutfitToNarrate[];
  formality: string;
  weatherSummary?: string | null;
  weatherStylingHint?: string | null;
  season?: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
  trendiness?: number | null;
  additionalDetails?: string | null;
  seasonalTrends?: ClosetOutfitSeasonalTrendsContext | null;
}): string {
  return [
    buildContextBlock(params),
    '',
    'Outfits to narrate (each already built from the client\'s real closet items — describe exactly these, nothing else):',
    JSON.stringify(params.outfits, null, 2),
    '',
    'Return a title and one-sentence whyItWorks for each outfit index above.',
  ].join('\n');
}
