import { promises as fs } from 'node:fs';

import pdfParse from 'pdf-parse';

import { openAiClient } from '../../ai/openai-client.js';
import { buildItineraryExtractionPrompt, itineraryExtractionResponseSchema, type ItineraryExtractionResponse } from '../../ai/prompts/trip-itinerary.prompts.js';
import { HttpError } from '../../lib/http-error.js';

// ── Itinerary PDF upload ("Plans" step, Trip Planner) ────────────────────────
//
// The uploaded PDF is read once for text extraction and never persisted —
// same "process then discard" privacy pattern as the stylist voice-brief
// recording (stylist-brief.service.ts). The caller (route) is responsible
// for deleting multer's temp file in a finally block regardless of outcome.
//
// V1 scope: text-layer PDFs only — no OCR for scanned/image-based documents.

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ExtractedItineraryDay = { date: string; location: string; summary: string };

export type ItineraryExtractionResult = {
  days: { date: string; summary: string }[];
  /** Entries the extraction found but that fell outside this trip's own date range/destination — surfaced so the UI can tell the user something was skipped, not silently drop it. */
  excludedCount: number;
};

/**
 * Deterministically filters AI-extracted itinerary days down to the overlap
 * with this specific trip's own destination and date range — the itinerary
 * document may cover a longer, multi-city trip than just this one leg, and
 * the trip's own Step 1 destination/dates stay authoritative rather than
 * being overridden by whatever the PDF happens to contain. Exported as a
 * standalone pure function so this logic (the part most worth getting
 * exactly right) is directly unit-testable without mocking the AI call.
 */
export function filterItineraryDaysToTripWindow(
  extractedDays: ExtractedItineraryDay[],
  params: { destination: string; departureDate: string; returnDate: string },
): ItineraryExtractionResult {
  const destinationToken = params.destination.split(',')[0]!.trim().toLowerCase();

  const days: { date: string; summary: string }[] = [];
  let excludedCount = 0;

  for (const day of extractedDays) {
    const dateInRange = ISO_DATE_PATTERN.test(day.date) && day.date >= params.departureDate && day.date <= params.returnDate;
    const location = day.location.trim().toLowerCase();
    const destinationMatches = destinationToken.length > 0 && (location.includes(destinationToken) || destinationToken.includes(location));

    if (dateInRange && destinationMatches) {
      days.push({ date: day.date, summary: day.summary });
    } else {
      excludedCount += 1;
    }
  }

  // Same date can legitimately appear more than once pre-filter (e.g. a
  // flight confirmation and a hotel confirmation extracted as separate
  // entries for the same day) — merge rather than showing duplicate cards.
  const merged = new Map<string, string>();
  for (const day of days) {
    const existing = merged.get(day.date);
    merged.set(day.date, existing ? `${existing} ${day.summary}` : day.summary);
  }

  return {
    days: [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, summary]) => ({ date, summary })),
    excludedCount,
  };
}

type ExtractInput = {
  filePath: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  supabaseUserId: string;
};

export const tripItineraryService = {
  async extractItineraryDays({ filePath, destination, departureDate, returnDate, supabaseUserId }: ExtractInput): Promise<ItineraryExtractionResult> {
    const fileBuffer = await fs.readFile(filePath);

    let text: string;
    try {
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text.trim();
    } catch {
      throw new HttpError(400, 'PDF_UNREADABLE', 'Could not read this PDF. Please try a different file.');
    }

    if (!text) {
      throw new HttpError(400, 'PDF_NO_TEXT', 'Could not find any text in this PDF — scanned or image-only itineraries aren\'t supported yet. You can still fill in your plans manually.');
    }

    const { instructions, userContent, jsonSchema } = buildItineraryExtractionPrompt(text);
    const result: ItineraryExtractionResponse = await openAiClient.createStructuredResponse({
      schema: itineraryExtractionResponseSchema,
      jsonSchema,
      instructions,
      userContent,
      supabaseUserId,
      feature: 'trip-itinerary-extraction',
    });

    return filterItineraryDaysToTripWindow(result.days, { destination, departureDate, returnDate });
  },
};
