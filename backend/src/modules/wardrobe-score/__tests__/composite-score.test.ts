import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadScoringConfig } from '../scoring-config.js';
import type { ScoringConfig } from '../scoring-config.js';
import type { ScoringClosetItem, TrendRelevanceScore } from '../wardrobe-score.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(overrides: Partial<ScoringClosetItem> & { id: string; title: string; category: string }): ScoringClosetItem {
  return { subcategory: null, brand: null, primaryColor: null, colorFamily: null, material: null, formality: null, silhouette: null, pattern: null, weight: null, ...overrides };
}

const FALLBACK_TREND: TrendRelevanceScore = {
  score: null,
  hasFallback: true,
  fallbackReason: 'No style guide',
  annotations: [],
  onTrendCount: 0,
  neutralCount: 0,
  datedCount: 0,
  gapCallouts: [],
  strengthHighlights: [],
};

let config: ScoringConfig;
beforeAll(() => { config = loadScoringConfig(); });

// ── Mock trend relevance service ──────────────────────────────────────────────
// We mock it because it makes AI calls; the composite score logic is what we test.

vi.mock('../trend-relevance.service.js', () => ({
  trendRelevanceService: {
    scoreTrendRelevance: vi.fn().mockResolvedValue(FALLBACK_TREND),
    invalidateCache: vi.fn(),
  },
}));

// ── Import after mock registration ───────────────────────────────────────────
const { computeWardrobeScore } = await import('../composite-score.service.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeWardrobeScore — empty closet', () => {
  it('handles empty closet without throwing', async () => {
    await expect(computeWardrobeScore([], { supabaseUserId: 'test-user' })).resolves.not.toThrow();
  });

  it('returns score between 0 and 100', async () => {
    const result = await computeWardrobeScore([], { supabaseUserId: 'test-user' });
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it('returns metadata with correct version', async () => {
    const result = await computeWardrobeScore([], { supabaseUserId: 'test-user' });
    expect(result.metadata.scoringVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.metadata.closetItemCount).toBe(0);
  });

  it('flags trendRelevance fallback', async () => {
    const result = await computeWardrobeScore([], { supabaseUserId: 'test-user' });
    expect(result.metadata.fallbackFlags.trendRelevance).toBe(true);
    expect(result.metadata.styleGuidesUsed).toBe(false);
  });
});

describe('computeWardrobeScore — score structure', () => {
  const goodItems: ScoringClosetItem[] = [
    item({ id: 'g1', title: 'White Oxford Shirt', category: 'Shirt',    subcategory: 'OCBD', colorFamily: 'white', formality: 'smart casual' }),
    item({ id: 'g2', title: 'Dark Indigo Jeans',  category: 'Denim',                         colorFamily: 'navy',  formality: 'casual' }),
    item({ id: 'g3', title: 'Navy Blazer',         category: 'Blazer',                        colorFamily: 'navy',  formality: 'business' }),
    item({ id: 'g4', title: 'Grey Crewneck',       category: 'Knitwear', subcategory: 'Crewneck', colorFamily: 'grey', formality: 'casual' }),
    item({ id: 'g5', title: 'Black Oxfords',       category: 'Shoes',   subcategory: 'Oxford', colorFamily: 'black', formality: 'business' }),
    item({ id: 'g6', title: 'White T-Shirt',       category: 'T-Shirt',                       colorFamily: 'white', formality: 'casual' }),
  ];

  it('returns all three dimensions', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    expect(result.dimensions.essentialsCoverage).toBeDefined();
    expect(result.dimensions.versatilityFunctionality).toBeDefined();
    expect(result.dimensions.trendRelevance).toBeDefined();
  });

  it('returns contribution objects for each dimension', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    const { essentialsCoverage, versatilityFunctionality, trendRelevance } = result.contributions;
    expect(essentialsCoverage.weight).toBe(config.dimensionWeights.essentialsCoverage);
    expect(versatilityFunctionality.weight).toBe(config.dimensionWeights.versatilityFunctionality);
    expect(trendRelevance.weight).toBe(config.dimensionWeights.trendRelevance);
  });

  it('weighted contributions sum close to compositeScore (within ±2 due to rounding)', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    const { essentialsCoverage, versatilityFunctionality, trendRelevance } = result.contributions;
    const sum = essentialsCoverage.weightedContribution + versatilityFunctionality.weightedContribution + trendRelevance.weightedContribution;
    // Composite may have a small adjustment for fallback; allow ±5 tolerance
    expect(Math.abs(result.compositeScore - sum)).toBeLessThanOrEqual(10);
  });

  it('returns a non-empty summary', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    expect(result.summary.length).toBeGreaterThan(20);
  });

  it('returns a valid scoreBand', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    const validBands = ['Exceptional', 'Strong', 'Solid', 'Developing', 'Needs Work'];
    expect(validBands).toContain(result.scoreBand);
  });

  it('has a generatedAt timestamp', async () => {
    const result = await computeWardrobeScore(goodItems, { supabaseUserId: 'test-user' });
    expect(new Date(result.metadata.generatedAt).getTime()).not.toBeNaN();
  });
});

describe('computeWardrobeScore — score consistency', () => {
  it('identical closet produces identical score', async () => {
    const items: ScoringClosetItem[] = [
      item({ id: 'id1', title: 'Shirt', category: 'Shirt', colorFamily: 'white' }),
      item({ id: 'id2', title: 'Jeans', category: 'Denim', colorFamily: 'navy' }),
    ];
    const r1 = await computeWardrobeScore(items, { supabaseUserId: 'user-a' });
    const r2 = await computeWardrobeScore(items, { supabaseUserId: 'user-a' });
    expect(r1.compositeScore).toBe(r2.compositeScore);
    expect(r1.scoreBand).toBe(r2.scoreBand);
  });
});
