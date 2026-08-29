import { describe, it, expect } from 'vitest';
import { seasonalTrendProfileResponseSchema, type FashionTrend } from '../seasonal-trends.schemas.js';

function trend(overrides: Partial<FashionTrend> & { rank: number; name: string }): FashionTrend {
  return {
    summary: 'summary',
    whyItMattersNow: 'why',
    garmentCategories: ['Trousers'],
    silhouettes: ['Straight'],
    colours: ['Navy'],
    materialsOrTextures: ['Wool'],
    footwear: ['Loafers'],
    accessories: ['Belt'],
    stylingRules: ['Pair with a knit.'],
    avoid: ['Baggy fits'],
    trendStrength: 7,
    lifecycle: 'current',
    versatility: 8,
    confidence: 0.8,
    ...overrides,
  };
}

function tenTrends(namePrefix = 'Trend'): FashionTrend[] {
  return Array.from({ length: 10 }, (_, i) => trend({ rank: i + 1, name: `${namePrefix} ${i + 1}` }));
}

function validProfile(overrides: Partial<Record<'business' | 'smartCasual' | 'casual', FashionTrend[]>> = {}) {
  return {
    season: 'fall',
    year: 2026,
    fashionGender: 'menswear',
    region: 'North America',
    generatedAt: new Date().toISOString(),
    business: overrides.business ?? tenTrends('Business'),
    smartCasual: overrides.smartCasual ?? tenTrends('SmartCasual'),
    casual: overrides.casual ?? tenTrends('Casual'),
  };
}

describe('seasonalTrendProfileResponseSchema', () => {
  it('accepts a well-formed profile with exactly 10 trends per category', () => {
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile());
    expect(result.success).toBe(true);
  });

  it('rejects a category with fewer than 10 trends', () => {
    const result = seasonalTrendProfileResponseSchema.safeParse(
      validProfile({ business: tenTrends('Business').slice(0, 9) }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a category with more than 10 trends', () => {
    const result = seasonalTrendProfileResponseSchema.safeParse(
      validProfile({ business: [...tenTrends('Business'), trend({ rank: 10, name: 'Extra' })] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects duplicate ranks', () => {
    const trends = tenTrends('Business');
    trends[1] = trend({ ...trends[1]!, rank: 1, name: trends[1]!.name });
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile({ business: trends }));
    expect(result.success).toBe(false);
  });

  it('rejects duplicate trend names (case-insensitive)', () => {
    const trends = tenTrends('Business');
    trends[1] = trend({ rank: trends[1]!.rank, name: trends[0]!.name.toUpperCase() });
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile({ business: trends }));
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range trendStrength', () => {
    const trends = tenTrends('Business');
    trends[0] = trend({ ...trends[0]!, trendStrength: 11 });
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile({ business: trends }));
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range confidence', () => {
    const trends = tenTrends('Business');
    trends[0] = trend({ ...trends[0]!, confidence: 1.5 });
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile({ business: trends }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid lifecycle value', () => {
    const trends = tenTrends('Business');
    trends[0] = trend({ ...trends[0]!, lifecycle: 'trending' as never });
    const result = seasonalTrendProfileResponseSchema.safeParse(validProfile({ business: trends }));
    expect(result.success).toBe(false);
  });

  it('rejects a completely malformed payload', () => {
    const result = seasonalTrendProfileResponseSchema.safeParse({ nonsense: true });
    expect(result.success).toBe(false);
  });
});
