import type { GenerateTripOutfitsRequest, RegenerateTripDayRequest } from '../../contracts/trips.contracts.js';
import type { JsonSchemaConfig } from '../openai-request-builder.js';
import { formatProfileContext } from '../prompt-context.js';
import { HEADLESS_GUARD, STYLE_GUARD, STYLE_PREAMBLE, QUALITY_ADDENDUM, QUALITY_ADDENDUM_2 } from './sketch.prompts.js';

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
  lines.push(`  Max shoes willing to pack: ${req.shoesCount}`);
  lines.push(`  Swimming: ${req.willSwim ? 'Yes — include a swimwear day' : 'No'}`);
  lines.push(`  Fancy nights out: ${req.fancyNights ? 'Yes — include at least one elevated evening outfit' : 'No'}`);
  lines.push(`  Workout clothes needed: ${req.workoutClothes ? 'Yes — include at least one activewear day' : 'No'}`);
  if (req.specialNeeds?.trim()) lines.push(`  Special needs: ${req.specialNeeds.trim()}`);

  // Previously generated days — for progressive (per-day) generation coherence
  if (req.previousDaysSummary && req.previousDaysSummary.length > 0) {
    lines.push('', 'ALREADY-PLANNED DAYS (vary garments — do NOT reuse identical pieces):');
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

export function buildTripOutfitsPrompt(
  req: GenerateTripOutfitsRequest,
  profile: PromptProfile,
): TripOutfitsPrompt {
  const totalDays = Math.min(14, daysBetween(req.departureDate, req.returnDate));

  const tempRuleLines: string[] = [];
  if (req.avgHighC != null) {
    if (req.avgHighC >= 24) {
      tempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): HOT. Use ONLY lightweight, breathable fabrics (linen, cotton, jersey, silk). Absolutely NO coats, wool sweaters, heavy knitwear, parkas, or thick layers.`);
    } else if (req.avgHighC >= 18) {
      tempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): WARM. Light fabrics preferred. A light denim jacket or unlined blazer is the maximum outerwear — no heavy coats or wool.`);
    } else if (req.avgHighC >= 10) {
      tempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): MILD-COOL. Medium-weight layers acceptable; a jacket or light coat is fine. No heavy parkas or extreme cold-weather gear.`);
    } else {
      tempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): COLD. Warm layers, coats, knitwear appropriate.`);
    }
  }

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
    '- shoes: one specific footwear choice.',
    '- bag: ONE specific bag choice for this day, or null only if no bag is needed (e.g. a beach swim morning where pieces stay at the hotel). Do NOT default to "canvas tote" — choose the bag TYPE that fits this day\'s context.',
    '  • Bag types to pick from: briefcase, structured work bag, laptop bag, backpack, daypack, messenger, crossbody, shoulder bag, top-handle, satchel, tote, weekender, duffel, holdall, clutch, evening bag, belt bag, sling bag.',
    '  • business / meeting / conference days → briefcase, structured work bag, slim laptop bag, or refined leather messenger (NEVER a casual canvas tote).',
    '  • adventure / sightseeing on the move → backpack, daypack, sling bag, or compact crossbody.',
    '  • beach_pool → roomy summer tote, straw tote, or water-friendly crossbody (only when going to/from the beach, not while swimming).',
    '  • dinner_out / wedding_event → small structured handbag, top-handle, or clutch (women) / slim leather pouch or no bag (men).',
    '  • travel_day → weekender, duffel, or carry-all that doubles as a personal item.',
    '  • relaxed / sightseeing on foot → shoulder bag, crossbody, or compact tote — type chosen for the outfit\'s formality, not as a fallback.',
    '  • For menswear profiles, avoid clutches, top-handle handbags, hobo bags, or other feminine-coded bag silhouettes — choose briefcase, messenger, backpack, weekender, crossbody, or shoulder bag instead.',
    '  • The bag must match the day\'s formality and the outfit\'s palette/material story — describe color and material (e.g. "Tan grained-leather briefcase", "Black ripstop daypack", "Stone canvas weekender", "Cognac suede shoulder bag", "Black nappa-leather clutch").',
    '  • If the user provided an anchor-piece bag, build the day around that bag rather than introducing a different one.',
    '- accessories: 0–3 items.',
    '- contextTags: 1–4 short tags (e.g. "beach-ready", "breathable", "semi-formal", "layerable").',
    ...tempRuleLines,
    '',
    formatProfileContext(profile),
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
            properties: {
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
            },
            required: ['dayIndex', 'date', 'title', 'dayType', 'rationale', 'pieces', 'shoes', 'bag', 'accessories', 'contextTags'],
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
): RegenerateDayPrompt {
  const dayLabel = formatDate(req.date);
  const previousList = req.previousPieces.map((p) => `  • ${p}`).join('\n');
  const previousShoes = req.previousShoes ? `  • ${req.previousShoes} (shoes)` : '';

  const regenTempRuleLines: string[] = [];
  if (req.avgHighC != null) {
    if (req.avgHighC >= 24) {
      regenTempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): HOT. Use ONLY lightweight, breathable fabrics (linen, cotton, jersey, silk). Absolutely NO coats, wool sweaters, heavy knitwear, parkas, or thick layers.`);
    } else if (req.avgHighC >= 18) {
      regenTempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): WARM. Light fabrics preferred. A light denim jacket or unlined blazer is the maximum outerwear — no heavy coats or wool.`);
    } else if (req.avgHighC >= 10) {
      regenTempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): MILD-COOL. Medium-weight layers acceptable; a jacket or light coat is fine. No heavy parkas or extreme cold-weather gear.`);
    } else {
      regenTempRuleLines.push(`- TEMPERATURE (avg high ${req.avgHighC}°C): COLD. Warm layers, coats, knitwear appropriate.`);
    }
  }

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
    '- bag: pick the bag TYPE that fits the dayType — briefcase / structured work bag for business or meeting; backpack or sling for adventure; clutch or top-handle (or slim pouch / no bag for men) for dinner_out and wedding_event; tote or beach-friendly crossbody for beach_pool; weekender or duffel for travel_day; shoulder bag, messenger, or crossbody for sightseeing and relaxed days. Never default to "canvas tote" unless the day context (e.g. casual beach errand) genuinely calls for one. For menswear profiles, avoid clutches and top-handle handbags. Set bag to null only if the day truly needs no bag.',
    ...regenTempRuleLines,
    '',
    formatProfileContext(profile),
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

  const parts = [
    HEADLESS_GUARD,
    STYLE_GUARD,
    subjectBrief,
    STYLE_PREAMBLE,
    outfitSection,
    QUALITY_ADDENDUM,
    QUALITY_ADDENDUM_2,
  ].filter(Boolean);

  return parts.join('\n\n');
}
