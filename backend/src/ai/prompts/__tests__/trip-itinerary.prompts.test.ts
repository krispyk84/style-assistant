import { describe, expect, it } from 'vitest';

import { buildItineraryExtractionPrompt, itineraryExtractionResponseSchema } from '../trip-itinerary.prompts.js';

describe('buildItineraryExtractionPrompt', () => {
  it('includes the itinerary text in the user content', () => {
    const { userContent } = buildItineraryExtractionPrompt('Conference confirmation: Sept 24, Paris.');
    expect(userContent[0]!.text).toContain('Conference confirmation: Sept 24, Paris.');
  });

  it('requires date/location/summary on every extracted day, with no extra properties', () => {
    const { jsonSchema } = buildItineraryExtractionPrompt('some text');
    const dayItem = (jsonSchema.schema.properties as any).days.items;
    expect(dayItem.required).toEqual(['date', 'location', 'summary']);
    expect(dayItem.additionalProperties).toBe(false);
  });
});

describe('itineraryExtractionResponseSchema', () => {
  it('accepts a well-formed extraction response', () => {
    const result = itineraryExtractionResponseSchema.safeParse({
      days: [{ date: '2026-09-24', location: 'Paris', summary: 'Conference all day' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty days array (nothing extractable)', () => {
    const result = itineraryExtractionResponseSchema.safeParse({ days: [] });
    expect(result.success).toBe(true);
  });

  it('rejects a day missing a required field', () => {
    const result = itineraryExtractionResponseSchema.safeParse({
      days: [{ date: '2026-09-24', summary: 'Missing location' }],
    });
    expect(result.success).toBe(false);
  });
});
