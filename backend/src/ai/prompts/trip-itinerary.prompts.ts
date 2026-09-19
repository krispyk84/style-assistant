import { z } from 'zod';

import type { JsonSchemaConfig } from '../openai-request-builder.js';

// ── Itinerary PDF extraction ─────────────────────────────────────────────────
//
// Turns the raw text of an uploaded itinerary PDF (flight/hotel/tour
// confirmations, a day-by-day plan) into a day-by-day breakdown the trip
// planner can use to ground its dayType/formalityTier decisions in the
// user's actual plans instead of guessing from trip-wide purposes alone.
//
// Deliberately minimal — matches exactly what buildTripDayShapePrompt (see
// trips.prompts.ts) actually consumes per day (a date and enough summary
// text to infer formality/activity), not a rich itinerary model. The
// destination/date overlap filtering happens deterministically in
// trip-itinerary.service.ts after this call returns, not here — this prompt
// is asked to extract everything it can find; it is not told about the
// trip's own dates/destination and does not need to self-filter.

export const itineraryExtractionResponseSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().min(1),
        location: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .max(60),
});

export type ItineraryExtractionResponse = z.infer<typeof itineraryExtractionResponseSchema>;

const INSTRUCTIONS = [
  'You extract a day-by-day breakdown from the raw text of a travel itinerary document (flight confirmations, hotel bookings, tour/conference schedules, a travel agent\'s day plan, etc.).',
  'For every distinct calendar date you can identify, produce one entry with:',
  '- date: the calendar date in YYYY-MM-DD format. Infer the year from context (booking dates, trip dates mentioned in the document) if a date appears without one — never omit the year.',
  '- location: the city/place that date\'s activity happens in, as named in the document (e.g. "Paris", "Rome"). If genuinely unclear, use the most recently mentioned location.',
  '- summary: a short (one sentence) plain description of what is happening that day and anything relevant to how someone would dress for it — e.g. "Morning flight to Paris, afternoon free", "All-day conference sessions", "Dinner reservation at a formal restaurant", "Free day, walking tour of the old town".',
  'Only extract dates that are genuinely part of the trip itinerary (arrival/departure, bookings, planned activities) — ignore unrelated dates like a document\'s print date, a booking\'s purchase date, or terms-and-conditions text.',
  'If the same date appears more than once (e.g. a flight confirmation and a separate hotel confirmation for the same day), merge them into a single entry summarizing both.',
  'If you cannot find any usable day-by-day information in the text, return an empty days array — do not invent entries.',
  'Return only structured JSON matching the schema.',
].join(' ');

export function buildItineraryExtractionPrompt(itineraryText: string): {
  instructions: string;
  userContent: { type: 'input_text'; text: string }[];
  jsonSchema: JsonSchemaConfig;
} {
  return {
    instructions: INSTRUCTIONS,
    userContent: [{ type: 'input_text', text: `Itinerary document text:\n\n${itineraryText}` }],
    jsonSchema: {
      name: 'itinerary_extraction',
      description: 'Day-by-day breakdown extracted from a travel itinerary document',
      schema: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            description: 'One entry per distinct calendar date found in the document',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'YYYY-MM-DD' },
                location: { type: 'string', description: 'City/place this date\'s activity happens in' },
                summary: { type: 'string', description: 'Short plain description of the day, relevant to how someone would dress for it' },
              },
              required: ['date', 'location', 'summary'],
              additionalProperties: false,
            },
            maxItems: 60,
          },
        },
        required: ['days'],
        additionalProperties: false,
      },
    },
  };
}
