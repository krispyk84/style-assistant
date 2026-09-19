import { describe, expect, it } from 'vitest';

import { mapLookRecommendationToTripDay } from '@/lib/trip-day-swap-mappers';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { LookRecommendation } from '@/types/look-request';

// ── What this file is ───────────────────────────────────────────────────────
//
// "Swap outfit" on a trip day: converts a chosen LookRecommendation (from
// Build Around a Piece / Ask a Stylist, an entirely different result shape
// than a trip day) into a full replacement for that day. This is the part
// most worth getting exactly right — the day's own identity (id/tripId/
// dayIndex/date/dayType/contextTags) must survive untouched while every
// outfit-content field is replaced, the bag/accessories split correctly,
// and the sketch resets so a fresh one gets generated for the new outfit.

function makeDay(overrides: Partial<TripOutfitDay> = {}): TripOutfitDay {
  return {
    id: 'day-1',
    tripId: 'trip-1',
    dayIndex: 2,
    date: '2026-09-25',
    title: 'Montmartre Art Walk',
    dayType: 'sightseeing',
    formalityTier: 'smart-casual',
    rationale: 'Old rationale',
    pieces: ['Old shirt', 'Old trousers'],
    shoes: 'Old sneakers',
    bag: 'Old bag',
    accessories: ['Old sunglasses'],
    contextTags: ['smart-casual', 'breathable'],
    sketchStatus: 'ready',
    sketchUrl: 'https://example.com/old-sketch.png',
    sketchJobId: 'job-old',
    feedback: 'love',
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<LookRecommendation> = {}): LookRecommendation {
  return {
    tier: 'casual',
    title: 'Effortless Parisian Layers',
    anchorItem: 'Olive overshirt',
    keyPieces: [
      { display_name: 'Olive overshirt', metadata: { category: 'Overshirt', color: 'olive', formality: 'Casual' } },
      { display_name: 'Beige pleated trousers', metadata: { category: 'Trousers', color: 'beige', formality: 'Casual' } },
    ],
    shoes: [{ display_name: 'White sneakers', metadata: { category: 'Sneakers', color: 'white', formality: 'Casual' } }],
    accessories: [
      { display_name: 'Tortoiseshell sunglasses', metadata: { category: 'Sunglasses', color: 'brown', formality: 'Casual' } },
      { display_name: 'Chocolate suede belt bag', metadata: { category: 'Bag', color: 'brown', formality: 'Casual' } },
    ],
    fitNotes: ['Relaxed through the shoulder'],
    whyItWorks: 'Breathable layers for a warm walking day.',
    stylingDirection: 'Keep it relaxed.',
    detailNotes: [],
    closetItemIds: ['item-1', 'item-2', 'item-3', 'item-4'],
    ...overrides,
  };
}

describe('mapLookRecommendationToTripDay', () => {
  it('preserves the original day identity fields untouched', () => {
    const day = makeDay();
    const result = mapLookRecommendationToTripDay(day, makeRecommendation(), 'casual');

    expect(result.id).toBe(day.id);
    expect(result.tripId).toBe(day.tripId);
    expect(result.dayIndex).toBe(day.dayIndex);
    expect(result.date).toBe(day.date);
    expect(result.dayType).toBe(day.dayType);
    expect(result.contextTags).toBe(day.contextTags);
  });

  it('replaces title, rationale, and sets formalityTier to the chosen tier', () => {
    const result = mapLookRecommendationToTripDay(makeDay(), makeRecommendation(), 'business');

    expect(result.title).toBe('Effortless Parisian Layers');
    expect(result.rationale).toBe('Breathable layers for a warm walking day.');
    expect(result.formalityTier).toBe('business');
  });

  it('flattens keyPieces into plain display-name strings', () => {
    const result = mapLookRecommendationToTripDay(makeDay(), makeRecommendation(), 'casual');
    expect(result.pieces).toEqual(['Olive overshirt', 'Beige pleated trousers']);
  });

  it('joins multiple shoe pieces into one string', () => {
    const recommendation = makeRecommendation({
      shoes: [
        { display_name: 'White sneakers', metadata: null },
        { display_name: 'Spare sandals', metadata: null },
      ],
    });
    const result = mapLookRecommendationToTripDay(makeDay(), recommendation, 'casual');
    expect(result.shoes).toBe('White sneakers, Spare sandals');
  });

  it('splits the Bag-category accessory into bag, leaving the rest in accessories', () => {
    const result = mapLookRecommendationToTripDay(makeDay(), makeRecommendation(), 'casual');
    expect(result.bag).toBe('Chocolate suede belt bag');
    expect(result.accessories).toEqual(['Tortoiseshell sunglasses']);
  });

  it('sets bag to null when no accessory is tagged Bag', () => {
    const recommendation = makeRecommendation({
      accessories: [{ display_name: 'Watch', metadata: { category: 'Watch', color: 'silver', formality: 'Casual' } }],
    });
    const result = mapLookRecommendationToTripDay(makeDay(), recommendation, 'casual');
    expect(result.bag).toBeNull();
    expect(result.accessories).toEqual(['Watch']);
  });

  it('handles string-shaped (unnormalized) pieces, not just OutfitPiece objects', () => {
    const recommendation = makeRecommendation({
      keyPieces: ['Plain string top' as unknown as LookRecommendation['keyPieces'][number]],
      accessories: ['Plain string bag' as unknown as LookRecommendation['accessories'][number]],
    });
    const result = mapLookRecommendationToTripDay(makeDay(), recommendation, 'casual');
    expect(result.pieces).toEqual(['Plain string top']);
    expect(result.bag).toBeNull();
    expect(result.accessories).toEqual(['Plain string bag']);
  });

  it('carries closetItemIds and framework through from the recommendation', () => {
    const result = mapLookRecommendationToTripDay(makeDay(), makeRecommendation(), 'casual');
    expect(result.closetItemIds).toEqual(['item-1', 'item-2', 'item-3', 'item-4']);
  });

  it('clears feedback back to null — a swapped outfit has no love/hate history yet', () => {
    const day = makeDay({ feedback: 'hate' });
    const result = mapLookRecommendationToTripDay(day, makeRecommendation(), 'casual');
    expect(result.feedback).toBeNull();
  });

  it('carries over the look\'s own already-generated sketch instead of discarding it', () => {
    const day = makeDay({ sketchStatus: 'ready', sketchUrl: 'https://example.com/old-day-sketch.png', sketchJobId: 'job-old' });
    const recommendation = makeRecommendation({ sketchStatus: 'ready', sketchImageUrl: 'https://example.com/look-sketch.png' });
    const result = mapLookRecommendationToTripDay(day, recommendation, 'casual');

    expect(result.sketchStatus).toBe('ready');
    expect(result.sketchUrl).toBe('https://example.com/look-sketch.png');
    // The old trip-side sketch job id is always cleared — it belongs to the
    // outfit that no longer exists, and carrying the URL over doesn't need it.
    expect(result.sketchJobId).toBeUndefined();
  });

  it('falls back to not_started (letting the auto-generate effect kick off a fresh sketch) when the look\'s own sketch was not actually ready', () => {
    const day = makeDay({ sketchStatus: 'ready', sketchUrl: 'https://example.com/old.png', sketchJobId: 'job-old' });
    const recommendation = makeRecommendation({ sketchStatus: 'pending', sketchImageUrl: null });
    const result = mapLookRecommendationToTripDay(day, recommendation, 'casual');

    expect(result.sketchStatus).toBe('not_started');
    expect(result.sketchUrl).toBeUndefined();
    expect(result.sketchJobId).toBeUndefined();
  });

  it('falls back to not_started when the recommendation has no sketch info at all', () => {
    const day = makeDay({ sketchStatus: 'ready', sketchUrl: 'https://example.com/old.png', sketchJobId: 'job-old' });
    const result = mapLookRecommendationToTripDay(day, makeRecommendation(), 'casual');

    expect(result.sketchStatus).toBe('not_started');
    expect(result.sketchUrl).toBeUndefined();
    expect(result.sketchJobId).toBeUndefined();
  });
});
