import { describe, it, expect } from 'vitest';
import { getFashionSeason, hemisphereFromLatitude } from '../season-math.js';

function utcDate(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day));
}

describe('getFashionSeason — Northern Hemisphere', () => {
  it('covers spring (Mar-May)', () => {
    expect(getFashionSeason(utcDate(2026, 3, 1), 'northern')).toEqual({ season: 'spring', year: 2026 });
    expect(getFashionSeason(utcDate(2026, 5, 31), 'northern')).toEqual({ season: 'spring', year: 2026 });
  });

  it('covers summer (Jun-Aug)', () => {
    expect(getFashionSeason(utcDate(2026, 6, 1), 'northern')).toEqual({ season: 'summer', year: 2026 });
    expect(getFashionSeason(utcDate(2026, 8, 31), 'northern')).toEqual({ season: 'summer', year: 2026 });
  });

  it('covers fall (Sep-Nov)', () => {
    expect(getFashionSeason(utcDate(2026, 9, 1), 'northern')).toEqual({ season: 'fall', year: 2026 });
    expect(getFashionSeason(utcDate(2026, 11, 30), 'northern')).toEqual({ season: 'fall', year: 2026 });
  });

  it('covers winter (Dec-Feb) and attributes Jan/Feb to the year the season started in', () => {
    expect(getFashionSeason(utcDate(2026, 12, 1), 'northern')).toEqual({ season: 'winter', year: 2026 });
    expect(getFashionSeason(utcDate(2027, 1, 15), 'northern')).toEqual({ season: 'winter', year: 2026 });
    expect(getFashionSeason(utcDate(2027, 2, 28), 'northern')).toEqual({ season: 'winter', year: 2026 });
  });

  it('does not split a single winter across two year values', () => {
    const dec = getFashionSeason(utcDate(2026, 12, 15), 'northern');
    const jan = getFashionSeason(utcDate(2027, 1, 15), 'northern');
    const feb = getFashionSeason(utcDate(2027, 2, 15), 'northern');
    expect(dec).toEqual(jan);
    expect(jan).toEqual(feb);
  });
});

describe('getFashionSeason — Southern Hemisphere', () => {
  it('Dec-Feb (northern winter) maps to summer', () => {
    expect(getFashionSeason(utcDate(2026, 12, 1), 'southern')).toEqual({ season: 'summer', year: 2026 });
    expect(getFashionSeason(utcDate(2027, 1, 15), 'southern')).toEqual({ season: 'summer', year: 2026 });
  });

  it('Mar-May (northern spring) maps to fall', () => {
    expect(getFashionSeason(utcDate(2026, 3, 1), 'southern')).toEqual({ season: 'fall', year: 2026 });
  });

  it('Jun-Aug (northern summer) maps to winter', () => {
    expect(getFashionSeason(utcDate(2026, 6, 1), 'southern')).toEqual({ season: 'winter', year: 2026 });
  });

  it('Sep-Nov (northern fall) maps to spring', () => {
    expect(getFashionSeason(utcDate(2026, 9, 1), 'southern')).toEqual({ season: 'spring', year: 2026 });
  });
});

describe('hemisphereFromLatitude', () => {
  it('defaults to northern when latitude is unavailable', () => {
    expect(hemisphereFromLatitude(null)).toBe('northern');
    expect(hemisphereFromLatitude(undefined)).toBe('northern');
    expect(hemisphereFromLatitude(Number.NaN)).toBe('northern');
  });

  it('classifies negative latitude as southern', () => {
    expect(hemisphereFromLatitude(-33.8)).toBe('southern');
  });

  it('classifies zero/positive latitude as northern', () => {
    expect(hemisphereFromLatitude(0)).toBe('northern');
    expect(hemisphereFromLatitude(40.7)).toBe('northern');
  });
});
