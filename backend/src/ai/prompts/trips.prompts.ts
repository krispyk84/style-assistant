import type { GenerateTripDayVariantsRequest, GenerateTripOutfitsRequest, RegenerateTripDayRequest } from '../../contracts/trips.contracts.js';
import type { JsonSchemaConfig } from '../openai-request-builder.js';
import { formatProfileContext } from '../prompt-context.js';
import { HEADLESS_GUARD, STYLE_GUARD, STYLE_PREAMBLE, QUALITY_ADDENDUM, QUALITY_ADDENDUM_2 } from './sketch-style-preamble.js';
import {
  buildTripTemperatureRuleLines,
  TRIP_DAY_BAG_RULE_LINES,
  TRIP_REGENERATION_BAG_RULE,
} from './trip-shared-rules.js';
import type { ClosetOutfitIndexItem, ClosetOutfitSlotShortlists } from './closet-outfits.prompts.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseISODate(iso: string): Date {
  // Parse YYYY-MM-DD as local midnight to avoid timezone shifts
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysBetween(start: string, end: string): number {
  const diff = parseISODate(end).getTime() - parseISODate(start).getTime();
  return Math.round(diff / 86_400_000) + 1; // inclusive both ends
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildTripContext(req: GenerateTripOutfitsRequest): string {
  const totalDays = Math.min(14, daysBetween(req.departureDate, req.returnDate));
  const nights = totalDays - 1;

  const lines: string[] = [
    `TRIP OVERVIEW:`,
    `  Destination: ${req.destination}`,
    `  Dates: ${formatDate(req.departureDate)} → ${formatDate(req.returnDate)} (${nights} night${nights !== 1 ? 's' : ''}, ${totalDays} day${totalDays !== 1 ? 's' : ''})`,
    `  Travel party: ${req.travelParty}`,
    `  Purpose(s): ${req.purposes.length > 0 ? req.purposes.join(', ') : 'Leisure'}`,
  ];

  lines.push('', 'CLIMATE:');
  lines.push(`  ${req.climateLabel}`);
  if (req.avgHighC != null && req.avgLowC != null) {
    lines.push(`  Avg high: ${req.avgHighC}°C  |  Avg low: ${req.avgLowC}°C`);
  }
  if (req.dressSeason) lines.push(`  Season: ${req.dressSeason}`);
  if (req.packingTag) lines.push(`  Packing weather tag: ${req.packingTag}`);

  lines.push('', 'ACTIVITIES & CONTEXT:');
  if (req.activities?.trim()) lines.push(`  ${req.activities.trim()}`);
  if (req.dressCode?.trim()) lines.push(`  Dress code: ${req.dressCode.trim()}`);
  lines.push(`  Style vibe: ${req.styleVibe}`);

  lines.push('', 'PACKING CONSTRAINTS:');
  lines.push(`  Carry-on only: ${req.carryOnOnly ? 'YES — re-use pieces and plan capsule wardrobe' : 'No checked bag restrictions'}`);
  lines.push(`  Laundry access: ${req.laundryAccess}`);
  lines.push(`  Max shoes willing to pack: ${req.shoesCount} — this is a HARD CAP on the number of DISTINCT pairs of shoes across the ENTIRE trip, not per day. Reuse the exact same pair (identical wording) across as many days as needed rather than describing a "new" pair each day.`);
  if (req.usedFootwear && req.usedFootwear.length > 0) {
    const shoesCapNum = req.shoesCount === '4+' ? 4 : Number(req.shoesCount ?? '2');
    const shoesCapReached = req.usedFootwear.length >= shoesCapNum;
    lines.push(`  Shoes already used on earlier days: ${req.usedFootwear.map((s) => `"${s}"`).join(', ')}.`);
    lines.push(
      shoesCapReached
        ? '  The shoes cap has been reached — you MUST reuse one of the pairs above (worded identically) for this day. Do NOT introduce a new pair.'
        : `  Prefer reusing one of the pairs above; you may introduce at most ${shoesCapNum - req.usedFootwear.length} more new distinct pair(s) if none of the above genuinely fits.`,
    );
  }
  lines.push(`  Max jackets/outerwear willing to pack: ${req.jacketsCount ?? '1'} — this is a HARD CAP on the number of DISTINCT jacket/coat/blazer/outerwear pieces across the ENTIRE trip, not per day. Reuse the exact same outerwear piece (identical wording) across as many days as needed rather than describing a "new" one each day — outerwear is bulky to pack, so treat it as a small fixed rotation, unlike shirts or accessories which can vary more freely. If the cap is 0, do not include any jacket/coat/blazer in any day's pieces.`);
  if (req.usedOuterwear && req.usedOuterwear.length > 0) {
    const capNum = Number(req.jacketsCount ?? '1');
    const capReached = req.usedOuterwear.length >= capNum;
    lines.push(`  Outerwear already used on earlier days: ${req.usedOuterwear.map((o) => `"${o}"`).join(', ')}.`);
    lines.push(
      capReached
        ? '  The outerwear cap has been reached — you MUST reuse one of the pieces above (worded identically) for any jacket/coat/blazer in this day, or omit outerwear entirely. Do NOT introduce a new one.'
        : `  Prefer reusing one of the pieces above; you may introduce at most ${capNum - req.usedOuterwear.length} more new distinct outerwear piece(s) if none of the above genuinely fits.`,
    );
  }
  lines.push(`  Swimming: ${req.willSwim ? 'Yes — include a swimwear day' : 'No'}`);
  lines.push(`  Fancy nights out: ${req.fancyNights ? 'Yes — include at least one elevated evening outfit' : 'No'}`);
  lines.push(`  Workout clothes needed: ${req.workoutClothes ? 'Yes — include at least one activewear day' : 'No'}`);

  if (req.specialNeeds?.trim()) {
    lines.push(
      '',
      'ADDITIONAL USER DETAILS — a user-supplied directive. Treat this as a HARD constraint that must visibly shape the relevant day(s), not a hint to skim:',
      `"${req.specialNeeds.trim()}"`,
      'If it references specific days (e.g. "the conference is days 2-3"), cross-reference against DAY TO PLAN / DAYS TO PLAN below to apply it to the right day(s) — e.g. a travel day it describes should stay comfortable/practical even if other days it calls out need to be more polished. If it specifies an event, audience, or activity, let that inform formality and piece selection for the day(s) it applies to.',
    );
  }

  // Previously generated days — for progressive (per-day) generation coherence
  if (req.previousDaysSummary && req.previousDaysSummary.length > 0) {
    lines.push('', 'ALREADY-PLANNED DAYS:');
    lines.push('  Vary the overall look day to day (don\'t repeat an identical full outfit) — but this does NOT apply to');
    lines.push('  jackets/outerwear: if a previous day already used a jacket/coat/blazer, REUSE that exact same piece here');
    lines.push('  (word it identically) rather than inventing a different one, staying within the outerwear cap above.');
    for (const summary of req.previousDaysSummary) {
      lines.push(`  ${summary}`);
    }
  }

  // Anchor pieces — included when user selected specific pieces to build around
  if (req.anchors && req.anchors.length > 0) {
    lines.push('', 'ANCHOR PIECES (build outfits around these core items):');
    lines.push('  The user has chosen these key pieces to anchor their trip wardrobe.');
    lines.push('  Re-use and style these pieces across multiple days where appropriate.');
    for (const anchor of req.anchors) {
      const hasImageReference = Boolean(anchor.uploadedImageId || anchor.imageUrl);
      const source = anchor.source === 'closet'
        ? ' (from closet)'
        : anchor.source === 'ai_suggested'
          ? ' (suggested)'
          : hasImageReference ? ' (user upload; see attached image)' : ' (user upload)';
      lines.push(`  - [${anchor.category}] ${anchor.label}${source}${anchor.rationale ? ` — ${anchor.rationale}` : ''}`);
    }
    if (req.anchorMode === 'guided') {
      lines.push('  Note: these were selected with guided recommendations. Build cohesive outfits around them.');
    }
  }

  return lines.join('\n');
}

function buildDayList(req: GenerateTripOutfitsRequest): string {
  const totalDays = Math.min(14, daysBetween(req.departureDate, req.returnDate));

  // Single-day mode: progressive generation
  if (req.generateOnlyDayIndex !== undefined) {
    const i = req.generateOnlyDayIndex;
    const date = addDays(req.departureDate, i);
    const label =
      i === 0 ? '(Departure / travel day)' :
      i === totalDays - 1 && totalDays > 1 ? '(Return / travel day)' : '';
    return [
      'DAY TO PLAN:',
      `  Day ${i + 1} of ${totalDays}: ${date}${label ? ' ' + label : ''}`,
    ].join('\n');
  }

  const dayLines: string[] = ['DAYS TO PLAN (generate one outfit per day):'];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(req.departureDate, i);
    const label =
      i === 0 ? '(Departure / travel day)' :
      i === totalDays - 1 && totalDays > 1 ? '(Return / travel day)' : '';
    dayLines.push(`  Day ${i + 1}: ${date}${label ? ' ' + label : ''}`);
  }
  return dayLines.join('\n');
}

export type TripOutfitsPrompt = {
  instructions: string;
  userContent: { type: 'input_text'; text: string }[];
  jsonSchema: {
    name: string;
    description: string;
    schema: Record<string, unknown>;
  };
};

// "From My Closet" (fullCloset) trip days no longer send a wardrobe index to
// any LLM prompt at all — item SELECTION is deterministic (closet-outfit-
// builder.ts, applied per-day in trips.service.ts using each day's dayType-
// derived formality target). These prompts now cover only the non-closet
// (guided/auto/manual anchor) path, plus the two fullCloset-specific prompts
// below (day "shape" planning, and narration of already-fixed real items).

export function buildTripOutfitsPrompt(
  req: GenerateTripOutfitsRequest,
  profile: PromptProfile,
  styleGuideContext?: string | null,
): TripOutfitsPrompt {
  const totalDays = Math.min(14, daysBetween(req.departureDate, req.returnDate));

  const instructions = [
    'You are an expert travel stylist. Generate a practical, stylish, day-by-day outfit plan for a trip.',
    '',
    'RULES:',
    '- Generate exactly one outfit object per day listed below.',
    '- dayIndex is 0-based (Day 1 = dayIndex 0).',
    '- Distribute day types intelligently: first/last days are usually travel_day; distribute sightseeing, business, dinner_out, beach_pool, adventure, wedding_event, relaxed, conference across the rest based on the trip purpose.',
    '- If carry-on only, plan re-use of versatile pieces across multiple days — call this out in rationale.',
    '- If laundry access is No, avoid outfits that require laundering every day.',
    '- title should be a short evocative label for the day (e.g. "Arrival in Kyoto", "Temple District Morning", "Black-Tie Gala").',
    '- rationale explains why this outfit works for this specific day (climate, activity, formality).',
    '- pieces: list each main garment with color + fabric hint (e.g. "Slim navy linen trousers"). Min 2, max 5.',
    `- If any piece is a jacket/coat/blazer/outerwear layer, treat it as a strictly limited, reusable resource — see the outerwear cap in PACKING CONSTRAINTS below. Do not describe a different jacket for each day; reuse the same one(s), worded identically, across the trip.`,
    '- shoes: one specific footwear choice.',
    ...TRIP_DAY_BAG_RULE_LINES,
    '- accessories: 0–3 items.',
    '- contextTags: 1–4 short tags (e.g. "beach-ready", "breathable", "semi-formal", "layerable").',
    ...buildTripTemperatureRuleLines(req.avgHighC),
    '',
    formatProfileContext(profile),
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
  ].join('\n');

  const generateInstruction = req.generateOnlyDayIndex !== undefined
    ? `Generate exactly 1 outfit object for Day ${req.generateOnlyDayIndex + 1} only. The day title should feel specific to ${req.destination} and the activities planned.`
    : `Generate exactly ${totalDays} outfit objects — one per day in order. All day titles should feel specific to the destination and activities.`;

  const userText = [
    buildTripContext(req),
    '',
    buildDayList(req),
    '',
    generateInstruction,
  ].join('\n');

  const dayProperties: Record<string, unknown> = {
    dayIndex:     { type: 'integer', description: '0-based day index' },
    date:         { type: 'string',  description: 'YYYY-MM-DD' },
    title:        { type: 'string',  description: 'Short evocative day title' },
    dayType:      { type: 'string',  enum: ['travel_day', 'sightseeing', 'business', 'meeting', 'dinner_out', 'beach_pool', 'adventure', 'wedding_event', 'relaxed', 'conference'] },
    rationale:    { type: 'string',  description: 'Why this outfit for this day (1-2 sentences)' },
    pieces:       { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5, description: 'Main garment pieces (color + fabric hint)' },
    shoes:        { type: 'string',  description: 'Footwear choice' },
    bag:          { type: ['string', 'null'], description: 'Bag or null' },
    accessories:  { type: 'array', items: { type: 'string' }, maxItems: 3 },
    contextTags:  { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
  };
  const dayRequired = ['dayIndex', 'date', 'title', 'dayType', 'rationale', 'pieces', 'shoes', 'bag', 'accessories', 'contextTags'];

  const jsonSchema: TripOutfitsPrompt['jsonSchema'] = {
    name: 'trip_outfits',
    description: 'Day-by-day outfit plan for a trip',
    schema: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          description: 'One outfit object per day, in chronological order',
          items: {
            type: 'object',
            properties: dayProperties,
            required: dayRequired,
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 14,
        },
      },
      required: ['days'],
      additionalProperties: false,
    },
  };

  return {
    instructions,
    userContent: [{ type: 'input_text', text: userText }],
    jsonSchema,
  };
}

// ── Regenerate single day prompt ─────────────────────────────────────────────

export type RegenerateDayPrompt = {
  instructions: string;
  userContent: { type: 'input_text'; text: string }[];
  jsonSchema: JsonSchemaConfig;
};

export function buildRegenerateDayPrompt(
  req: RegenerateTripDayRequest,
  profile: PromptProfile,
  styleGuideContext?: string | null,
): RegenerateDayPrompt {
  const dayLabel = formatDate(req.date);
  const previousList = req.previousPieces.map((p) => `  • ${p}`).join('\n');
  const previousShoes = req.previousShoes ? `  • ${req.previousShoes} (shoes)` : '';

  const instructions = [
    'You are an expert travel stylist. Generate ONE fresh outfit alternative for a single trip day.',
    '',
    'RULES:',
    '- Return exactly one day object.',
    '- dayIndex and date must match what is provided — do NOT change them.',
    '- Keep the same dayType — do NOT change it.',
    '- Do NOT repeat the previous outfit pieces. Generate a genuinely different look.',
    '- title should be a different evocative label from before.',
    '- Be specific about garment descriptions (color + fabric hint).',
    TRIP_REGENERATION_BAG_RULE,
    ...buildTripTemperatureRuleLines(req.avgHighC),
    '',
    formatProfileContext(profile),
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
  ].join('\n');

  const userText = [
    `TRIP: ${req.destination}, ${req.country}`,
    `Climate: ${req.climateLabel || 'Not specified'}`,
    req.activities ? `Activities: ${req.activities}` : '',
    req.dressCode ? `Dress code: ${req.dressCode}` : '',
    `Style vibe: ${req.styleVibe}`,
    req.purposes.length > 0 ? `Trip purpose: ${req.purposes.join(', ')}` : '',
    '',
    `Day to regenerate: Day ${req.dayIndex + 1} — ${dayLabel} (${req.dayType})`,
    '',
    'PREVIOUS OUTFIT (do NOT repeat these pieces):',
    previousList,
    previousShoes,
    '',
    'Generate a fresh alternative outfit for this day.',
  ].filter(Boolean).join('\n');

  const daySchema = {
    type: 'object',
    properties: {
      dayIndex:     { type: 'integer' },
      date:         { type: 'string' },
      title:        { type: 'string' },
      dayType:      { type: 'string', enum: ['travel_day', 'sightseeing', 'business', 'meeting', 'dinner_out', 'beach_pool', 'adventure', 'wedding_event', 'relaxed', 'conference'] },
      rationale:    { type: 'string' },
      pieces:       { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
      shoes:        { type: 'string' },
      bag:          { type: ['string', 'null'] },
      accessories:  { type: 'array', items: { type: 'string' }, maxItems: 3 },
      contextTags:  { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
    },
    required: ['dayIndex', 'date', 'title', 'dayType', 'rationale', 'pieces', 'shoes', 'bag', 'accessories', 'contextTags'],
    additionalProperties: false,
  };

  return {
    instructions,
    userContent: [{ type: 'input_text', text: userText }],
    jsonSchema: {
      name: 'trip_day_regeneration',
      description: 'Single regenerated day outfit',
      schema: {
        type: 'object',
        properties: { day: daySchema },
        required: ['day'],
        additionalProperties: false,
      },
    },
  };
}

// ── Trip day "shape" prompt (fullCloset only) ────────────────────────────────
// Item selection is deterministic (closet-outfit-builder.ts) — this prompt
// only decides the day type and context tags before the real items are picked
// in code; the day's title is decided later, in narration, once the real
// items are known. Kept as its own small LLM call because day-type
// distribution is a genuinely creative, context-sensitive judgment (which
// days are business vs. relaxed, informed by free-text trip details) that a
// fixed heuristic would handle far more crudely.

const DAY_TYPE_ENUM = ['travel_day', 'sightseeing', 'business', 'meeting', 'dinner_out', 'beach_pool', 'adventure', 'wedding_event', 'relaxed', 'conference'];

export type TripDayShapePrompt = {
  instructions: string;
  userContent: { type: 'input_text'; text: string }[];
  jsonSchema: JsonSchemaConfig;
};

export function buildTripDayShapePrompt(
  req: GenerateTripOutfitsRequest,
  profile: PromptProfile,
  styleGuideContext?: string | null,
): TripDayShapePrompt {
  const totalDays = Math.min(14, daysBetween(req.departureDate, req.returnDate));

  const instructions = [
    'You are an expert travel stylist planning the SHAPE of a day-by-day trip wardrobe — day type, title, and context tags only. Item selection happens separately, in code, from the client\'s own closet.',
    '',
    'RULES:',
    '- Generate exactly one entry per day listed below.',
    '- dayIndex is 0-based (Day 1 = dayIndex 0).',
    '- Distribute day types intelligently: first/last days are usually travel_day; distribute sightseeing, business, dinner_out, beach_pool, adventure, wedding_event, relaxed, conference across the rest based on the trip purpose, activities, and any day-specific user details below.',
    '- contextTags: 1–4 short tags (e.g. "beach-ready", "breathable", "semi-formal", "layerable").',
    '',
    formatProfileContext(profile),
    styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
  ].join('\n');

  const generateInstruction = req.generateOnlyDayIndex !== undefined
    ? `Generate exactly 1 entry for Day ${req.generateOnlyDayIndex + 1} only.`
    : `Generate exactly ${totalDays} entries — one per day in order.`;

  const userText = [
    buildTripContext(req),
    '',
    buildDayList(req),
    '',
    generateInstruction,
  ].join('\n');

  return {
    instructions,
    userContent: [{ type: 'input_text', text: userText }],
    jsonSchema: {
      name: 'trip_day_shape',
      description: 'Day-by-day trip shape (day type, title, tags) — item selection happens separately',
      schema: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            description: 'One shape entry per day, in chronological order',
            items: {
              type: 'object',
              properties: {
                dayIndex:    { type: 'integer', description: '0-based day index' },
                date:        { type: 'string', description: 'YYYY-MM-DD' },
                dayType:     { type: 'string', enum: DAY_TYPE_ENUM },
                contextTags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
              },
              required: ['dayIndex', 'date', 'dayType', 'contextTags'],
              additionalProperties: false,
            },
            minItems: 1,
            maxItems: 14,
          },
        },
        required: ['days'],
        additionalProperties: false,
      },
    },
  };
}

// ── Trip day choice + narration prompt (fullCloset only) ─────────────────────
// Mirrors closet-outfits.prompts.ts's choice+narrate step: each slot's
// shortlist (real, formality-appropriate closet items only, from
// closet-outfit-builder.ts's buildOutfitSlotShortlists) is injected as a
// JSON-schema `enum` per slot, so the model can only return an id that was
// actually offered — but it still makes the color/texture/silhouette/
// capsule-wardrobe-reuse judgment and writes the title + rationale.

export type TripDayToChoose = {
  index: number;
  dayType: string;
  shortlists: ClosetOutfitSlotShortlists;
};

export function buildTripDayChoiceSystemPrompt(): string {
  return [
    'You are an expert travel stylist. For each trip day below, every slot already lists ONLY real, formality-appropriate items from the client\'s own closet — you must choose exactly one id per slot listed for that day (the schema enforces this: you cannot invent an id or return one that is not listed).',
    '',
    'HARD RULES:',
    '1. COLOR COORDINATION: do not choose 3 or more pieces in the same color/color-family for one day — build real contrast.',
    '2. TEXTURE & SILHOUETTE: use each item\'s material/silhouette metadata to create intentional contrast and balance.',
    '3. CAPSULE WARDROBE: treat the wardrobe as one coherent travel capsule — prefer reusing the same versatile pieces across days over picking a fully different item every day. Seeing the same item appear in multiple days\' shortlists is expected; deliberate reuse is a feature, not a failure.',
    '4. SUITS: a Suit item is ONE physical piece that is both the trousers AND the jacket — it can appear in both the BOTTOMS and OUTERWEAR options. If you choose a Suit id for BOTTOMS, you MUST choose that exact same Suit id for OUTERWEAR too (never a different jacket/blazer, and never a different suit). A suit is always worn with a proper collared dress shirt underneath — never pair it with a polo or t-shirt for TOPS.',
    '5. Give the day a short evocative title (e.g. "Arrival in Kyoto", "Temple District Morning", "Black-Tie Gala") and a 1-2 sentence rationale referencing the actual chosen pieces by their descriptive name and the day\'s type/climate/activities.',
    '6. NEVER include an item\'s id in the title or rationale text — ids belong only in chosenIds. Refer to every piece by name only.',
    '7. NEVER mention or imply a piece that isn\'t one of your actual chosenIds for that day. If a slot (e.g. LAYERING or OUTERWEAR) wasn\'t offered to you at all for this day, that means the wardrobe has nothing for it right now — do not invent one in the rationale ("a light jacket adds...") or title. Only describe the exact pieces you actually chose ids for.',
    '8. Return one entry per day index provided, matched by "index". Do not skip or reorder.',
    '',
    'Return ONLY valid JSON matching the provided schema. No markdown, no prose outside the JSON.',
  ].join('\n');
}

export function buildTripDayChoiceUserPrompt(params: {
  days: TripDayToChoose[];
  destination: string;
  climateLabel?: string | null;
  avgHighC?: number | null;
}): string {
  const lines: (string | null)[] = [
    `TRIP: ${params.destination}`,
    params.climateLabel ? `Climate: ${params.climateLabel}` : null,
    ...buildTripTemperatureRuleLines(params.avgHighC ?? undefined),
    '',
  ];

  for (const day of params.days) {
    lines.push(`DAY ${day.index} (dayType: ${day.dayType}):`);
    for (const [slot, items] of Object.entries(day.shortlists)) {
      if (!items?.length) continue;
      lines.push(`  ${slot.toUpperCase()} options (choose exactly one id):`, JSON.stringify(items, null, 2));
    }
    lines.push('');
  }

  lines.push('Return a title, rationale, and chosenIds for each day index above.');
  return lines.filter((line): line is string => line !== null).join('\n');
}

/** Variant-swap version — mirrors buildClosetOutfitVariationsChoiceUserPrompt. */
export function buildTripDayVariantsChoiceUserPrompt(params: {
  dayIndex: number;
  dayType: string;
  keepItems: ClosetOutfitIndexItem[];
  swapShortlists: ClosetOutfitSlotShortlists;
  destination: string;
  climateLabel?: string | null;
  avgHighC?: number | null;
}): string {
  const lines: (string | null)[] = [
    `TRIP: ${params.destination}`,
    params.climateLabel ? `Climate: ${params.climateLabel}` : null,
    ...buildTripTemperatureRuleLines(params.avgHighC ?? undefined),
    '',
    `DAY ${params.dayIndex} (dayType: ${params.dayType})`,
    '',
    'KEEP UNCHANGED in every variant, exactly as listed (do not re-describe or replace):',
    JSON.stringify(params.keepItems, null, 2),
    '',
  ];

  for (const [slot, items] of Object.entries(params.swapShortlists)) {
    if (!items?.length) continue;
    lines.push(`REPLACE the ${slot.toUpperCase()} slot — choose exactly one id from below, thoughtfully coordinated with the kept pieces above (color, texture, silhouette):`, JSON.stringify(items, null, 2), '');
  }

  lines.push('Build up to 5 distinct variants, each swapping in a genuinely different, well-coordinated replacement — do not repeat the same replacement across variants unless the options genuinely run out.');
  return lines.filter((line): line is string => line !== null).join('\n');
}

// ── Trip day sketch prompt ────────────────────────────────────────────────────
// Uses the same 8-slot assembly as buildTierSketchPrompt so travel sketches
// are visually indistinguishable in style from standard outfit sketches.
// Slot order: HEADLESS_GUARD → STYLE_GUARD → subjectBrief → STYLE_PREAMBLE
//           → outfitSection → QUALITY_ADDENDUM → QUALITY_ADDENDUM_2
// (No anchor color block — trip outfits have no uploaded anchor item.)

export function buildTripDaySketchPrompt(params: {
  destination: string;
  dayTitle: string;
  climateLabel: string;
  pieces: string[];
  shoes: string;
  accessories: string[];
  subjectBrief: string;
}): string {
  const { destination, dayTitle, climateLabel, pieces, shoes, accessories, subjectBrief } = params;

  const outfitLines: string[] = [
    ...pieces.map((p) => `- garment: ${p}`),
    `- shoes: ${shoes}`,
    ...accessories.map((a) => `- accessory: ${a}`),
  ];

  // Setting note sits inside the outfit section so it informs garment rendering
  // context without overriding any style directive.
  const outfitSection = [
    `Outfit (${dayTitle} — ${destination}, ${climateLabel}):`,
    outfitLines.join('\n'),
  ].join('\n');

  const hasOuterwearOrExtraLayer = pieces.length > 2; // bottoms + top is the 2-piece floor; anything beyond that includes a layer/outerwear

  // Hard "exact item list" constraint — mirrors closet-outfit-sketch.prompts.ts's
  // exclusivityRule. Without this, the model sometimes adds an unlisted piece
  // (most often a jacket or an extra top) to make the look feel more
  // "complete", even when that role has nothing listed above at all. Placed
  // right after the headless/style guards — same reasoning as HEADLESS_GUARD
  // being slot 0: a hard constraint buried after several paragraphs of
  // editorial styling language gets diluted by the time the model reaches it.
  const exclusivityRule =
    'EXACT ITEM LIST — HARD CONSTRAINT, read this before anything else below: the garments/shoes/accessories listed here are the ONLY items the figure wears. ' +
    `${outfitSection}\n` +
    'Do not add any garment, layer, or accessory that is not explicitly listed above — no extra jacket, blazer, coat, cardigan, hoodie, sweater, undershirt, scarf, hat, bag, jewelry, or any other piece, no matter how much more "complete", "editorial", or weather-appropriate the look would feel with one. ' +
    (hasOuterwearOrExtraLayer
      ? 'The garments listed above already include every layer this figure wears — do not add a further layer beyond what is listed.'
      : 'No jacket, coat, blazer, cardigan, hoodie, or sweater is listed above — the figure wears ONLY the single top listed, with nothing else over or under it, regardless of season or climate.');

  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    exclusivityRule,
    subjectBrief,
    STYLE_PREAMBLE,
    'Every listed item is a REAL garment the wearer already owns — render each one true to its stated color, pattern, and material rather than inventing a different interpretation.',
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
    hasOuterwearOrExtraLayer
      ? 'GARMENT COUNT VERIFICATION (check before finalizing): count the garments you have drawn on the figure — does the count match exactly the garments listed at the top of this prompt, no more? If you have added any unlisted jacket, layer, or top, that is a hard failure — remove it before finalizing.'
      : 'GARMENT COUNT VERIFICATION (check before finalizing): this figure wears exactly ONE top and nothing else layered over or under it. If you have drawn a jacket, cardigan, hoodie, or second top of any kind, that is a hard failure — remove it before finalizing.',
  ].filter(Boolean);

  return parts.join('\n\n');
}
