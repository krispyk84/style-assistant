import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const createStructuredResponse = vi.fn();
vi.mock('../../../ai/openai-client.js', () => ({
  openAiClient: { createStructuredResponse },
}));

const pdfParseMock = vi.fn();
vi.mock('pdf-parse', () => ({ default: pdfParseMock }));

const { tripItineraryService, filterItineraryDaysToTripWindow } = await import('../trip-itinerary.service.js');

// ── What this file is ───────────────────────────────────────────────────────
//
// A user reported (via the Trip Planner) that they want to upload a real
// itinerary and have it ground the trip's day-by-day plan instead of the
// app guessing from generic trip-wide purposes. The itinerary document may
// cover more days or more cities than this specific trip (a multi-city PDF,
// this trip is just one leg) — filterItineraryDaysToTripWindow is the part
// most worth getting exactly right, since it's what keeps the trip's own
// Step 1 destination/dates authoritative rather than letting the PDF
// override them. It's exported as a standalone pure function so this is
// tested directly, not just through the AI-mocked service call.

describe('filterItineraryDaysToTripWindow', () => {
  const tripWindow = { destination: 'Paris, France', departureDate: '2026-09-23', returnDate: '2026-09-27' };

  it('keeps entries within the date range and matching the destination', () => {
    const result = filterItineraryDaysToTripWindow(
      [{ date: '2026-09-24', location: 'Paris', summary: 'Conference all day' }],
      tripWindow,
    );

    expect(result.days).toEqual([{ date: '2026-09-24', summary: 'Conference all day' }]);
    expect(result.excludedCount).toBe(0);
  });

  it('excludes entries outside the trip\'s date range — itinerary longer than the trip', () => {
    const result = filterItineraryDaysToTripWindow(
      [
        { date: '2026-09-20', location: 'Paris', summary: 'Arrival, pre-trip days' },
        { date: '2026-09-24', location: 'Paris', summary: 'Conference all day' },
        { date: '2026-09-30', location: 'Paris', summary: 'Extra days after this trip' },
      ],
      tripWindow,
    );

    expect(result.days).toEqual([{ date: '2026-09-24', summary: 'Conference all day' }]);
    expect(result.excludedCount).toBe(2);
  });

  it('excludes entries for a different city — multi-destination itinerary', () => {
    const result = filterItineraryDaysToTripWindow(
      [
        { date: '2026-09-24', location: 'Paris', summary: 'Conference all day' },
        { date: '2026-09-25', location: 'Rome', summary: 'Fly to Rome, sightseeing' },
      ],
      tripWindow,
    );

    expect(result.days).toEqual([{ date: '2026-09-24', summary: 'Conference all day' }]);
    expect(result.excludedCount).toBe(1);
  });

  it('matches destination case-insensitively and against a more specific location string', () => {
    const result = filterItineraryDaysToTripWindow(
      [{ date: '2026-09-24', location: 'CDG Airport, paris', summary: 'Morning arrival' }],
      tripWindow,
    );

    expect(result.days).toHaveLength(1);
  });

  it('merges multiple entries for the same date into one', () => {
    const result = filterItineraryDaysToTripWindow(
      [
        { date: '2026-09-24', location: 'Paris', summary: 'Morning flight lands' },
        { date: '2026-09-24', location: 'Paris', summary: 'Hotel check-in, conference starts at 2pm' },
      ],
      tripWindow,
    );

    expect(result.days).toHaveLength(1);
    expect(result.days[0]!.summary).toContain('Morning flight lands');
    expect(result.days[0]!.summary).toContain('conference starts at 2pm');
  });

  it('excludes an entry with a malformed date rather than throwing', () => {
    const result = filterItineraryDaysToTripWindow(
      [{ date: 'not-a-date', location: 'Paris', summary: 'Unparseable' }],
      tripWindow,
    );

    expect(result.days).toEqual([]);
    expect(result.excludedCount).toBe(1);
  });

  it('returns everything excluded, nothing kept, when there is no overlap at all', () => {
    const result = filterItineraryDaysToTripWindow(
      [{ date: '2026-01-01', location: 'Tokyo', summary: 'Unrelated trip' }],
      tripWindow,
    );

    expect(result.days).toEqual([]);
    expect(result.excludedCount).toBe(1);
  });

  it('sorts the kept days chronologically', () => {
    const result = filterItineraryDaysToTripWindow(
      [
        { date: '2026-09-26', location: 'Paris', summary: 'Dinner' },
        { date: '2026-09-24', location: 'Paris', summary: 'Conference' },
      ],
      tripWindow,
    );

    expect(result.days.map((d) => d.date)).toEqual(['2026-09-24', '2026-09-26']);
  });
});

describe('tripItineraryService.extractItineraryDays', () => {
  let tempFile: string;

  beforeEach(async () => {
    tempFile = path.join(os.tmpdir(), `trip-itinerary-test-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, Buffer.from([0, 1, 2, 3]));
    createStructuredResponse.mockReset();
    pdfParseMock.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tempFile, { force: true });
  });

  it('extracts PDF text, calls the AI extraction with it, and filters to the trip window', async () => {
    pdfParseMock.mockResolvedValue({ text: 'Conference confirmation: Sept 24, Paris.' });
    createStructuredResponse.mockResolvedValue({
      days: [
        { date: '2026-09-24', location: 'Paris', summary: 'Conference all day' },
        { date: '2026-01-01', location: 'Tokyo', summary: 'Unrelated' },
      ],
    });

    const result = await tripItineraryService.extractItineraryDays({
      filePath: tempFile,
      destination: 'Paris, France',
      departureDate: '2026-09-23',
      returnDate: '2026-09-27',
      supabaseUserId: 'user-1',
    });

    expect(result.days).toEqual([{ date: '2026-09-24', summary: 'Conference all day' }]);
    expect(result.excludedCount).toBe(1);

    expect(createStructuredResponse).toHaveBeenCalledTimes(1);
    const call = createStructuredResponse.mock.calls[0]![0];
    expect(call.feature).toBe('trip-itinerary-extraction');
    expect(call.supabaseUserId).toBe('user-1');
    expect(call.userContent[0].text).toContain('Conference confirmation: Sept 24, Paris.');
  });

  it('throws a clear error when the PDF has no extractable text (scanned/image-only)', async () => {
    pdfParseMock.mockResolvedValue({ text: '   ' });

    await expect(
      tripItineraryService.extractItineraryDays({
        filePath: tempFile,
        destination: 'Paris, France',
        departureDate: '2026-09-23',
        returnDate: '2026-09-27',
        supabaseUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'PDF_NO_TEXT' });

    expect(createStructuredResponse).not.toHaveBeenCalled();
  });

  it('throws a clear error when the PDF cannot be parsed at all', async () => {
    pdfParseMock.mockRejectedValue(new Error('not a valid PDF'));

    await expect(
      tripItineraryService.extractItineraryDays({
        filePath: tempFile,
        destination: 'Paris, France',
        departureDate: '2026-09-23',
        returnDate: '2026-09-27',
        supabaseUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'PDF_UNREADABLE' });
  });
});
