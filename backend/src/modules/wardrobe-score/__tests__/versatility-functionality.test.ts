import { describe, it, expect, beforeAll } from 'vitest';
import {
  scoreOccasionSpread,
  scoreColorDistribution,
  scoreCategoryGaps,
  scoreMixAndMatch,
  scoreVersatilityFunctionality,
} from '../versatility-functionality.service.js';
import { loadScoringConfig } from '../scoring-config.js';
import type { ScoringConfig } from '../scoring-config.js';
import type { ScoringClosetItem } from '../wardrobe-score.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(overrides: Partial<ScoringClosetItem> & { id: string; title: string; category: string }): ScoringClosetItem {
  return { subcategory: null, brand: null, primaryColor: null, colorFamily: null, material: null, formality: null, silhouette: null, pattern: null, weight: null, ...overrides };
}

let config: ScoringConfig;
beforeAll(() => { config = loadScoringConfig(); });

// ── Occasion Spread ───────────────────────────────────────────────────────────

describe('scoreOccasionSpread', () => {
  it('returns score 0 for empty closet', () => {
    const result = scoreOccasionSpread([]);
    expect(result.score).toBe(0);
    expect(result.missingOccasions).toContain('Casual');
    expect(result.missingOccasions).toContain('Business / office');
  });

  it('penalizes missing business coverage', () => {
    const casualOnly = [
      item({ id: '1', title: 'T-shirt', category: 'T-Shirt', formality: 'casual' }),
      item({ id: '2', title: 'Jeans', category: 'Denim', formality: 'casual' }),
      item({ id: '3', title: 'Sneakers', category: 'Shoes', formality: 'casual' }),
    ];
    const result = scoreOccasionSpread(casualOnly);
    expect(result.missingOccasions).toContain('Business / office');
    expect(result.score).toBeLessThan(70);
  });

  it('rewards balanced occasion coverage', () => {
    const balanced = [
      item({ id: 'b1', title: 'Jeans', category: 'Denim', formality: 'casual' }),
      item({ id: 'b2', title: 'T-shirt', category: 'T-Shirt', formality: 'casual' }),
      item({ id: 'b3', title: 'Chinos', category: 'Trousers', formality: 'smart casual' }),
      item({ id: 'b4', title: 'Polo', category: 'Shirt', formality: 'smart casual' }),
      item({ id: 'b5', title: 'Suit Trousers', category: 'Trousers', formality: 'business' }),
      item({ id: 'b6', title: 'Dress Shirt', category: 'Shirt', formality: 'business' }),
      item({ id: 'b7', title: 'Blazer', category: 'Blazer', formality: 'business' }),
      item({ id: 'b8', title: 'Suit', category: 'Suit', formality: 'formal' }),
    ];
    const result = scoreOccasionSpread(balanced);
    expect(result.score).toBeGreaterThan(60);
    expect(result.missingOccasions).toHaveLength(0);
  });

  it('uses category inference for items with no formality metadata', () => {
    const noFormalityMeta = [
      item({ id: 'n1', title: 'Slim Suit', category: 'Suit' }),
      item({ id: 'n2', title: 'Jeans', category: 'Denim' }),
    ];
    const result = scoreOccasionSpread(noFormalityMeta);
    // Suit should be inferred as business, jeans as casual
    expect(result.businessCount).toBeGreaterThan(0);
    expect(result.casualCount).toBeGreaterThan(0);
  });
});

// ── Color Distribution ────────────────────────────────────────────────────────

describe('scoreColorDistribution', () => {
  it('returns baseline score when no color metadata', () => {
    const noColor = [
      item({ id: 'c1', title: 'Item 1', category: 'Shirt' }),
      item({ id: 'c2', title: 'Item 2', category: 'Trousers' }),
    ];
    const result = scoreColorDistribution(noColor);
    expect(result.score).toBeGreaterThan(0); // baseline, not zero
  });

  it('scores very narrow palette low', () => {
    const oneColor = Array.from({ length: 5 }, (_, i) =>
      item({ id: `s${i}`, title: `Item ${i}`, category: 'Shirt', colorFamily: 'black' })
    );
    const result = scoreColorDistribution(oneColor);
    expect(result.uniqueColorFamilies).toBe(1);
    expect(result.score).toBeLessThan(60);
  });

  it('rewards balanced neutral/accent palette', () => {
    const balanced = [
      item({ id: 'p1', title: 'White Shirt', category: 'Shirt', colorFamily: 'white' }),
      item({ id: 'p2', title: 'Navy Trousers', category: 'Trousers', colorFamily: 'navy' }),
      item({ id: 'p3', title: 'Grey Sweater', category: 'Knitwear', colorFamily: 'grey' }),
      item({ id: 'p4', title: 'Black Shoes', category: 'Shoes', colorFamily: 'black' }),
      item({ id: 'p5', title: 'Camel Coat', category: 'Coat', colorFamily: 'camel' }),
      item({ id: 'p6', title: 'Burgundy Shirt', category: 'Shirt', colorFamily: 'burgundy' }),
    ];
    const result = scoreColorDistribution(balanced);
    expect(result.score).toBeGreaterThan(60);
    expect(result.uniqueColorFamilies).toBeGreaterThanOrEqual(4);
  });
});

// ── Category Gaps ─────────────────────────────────────────────────────────────

describe('scoreCategoryGaps', () => {
  it('detects missing footwear', () => {
    const noShoes = [
      item({ id: 'g1', title: 'Shirt', category: 'Shirt' }),
      item({ id: 'g2', title: 'Jeans', category: 'Denim' }),
    ];
    const result = scoreCategoryGaps(noShoes);
    expect(result.missingCategories).toContain('Footwear');
    expect(result.gapCallouts.some((c) => c.toLowerCase().includes('footwear'))).toBe(true);
  });

  it('detects missing outerwear', () => {
    const noOuter = [
      item({ id: 'o1', title: 'Jeans', category: 'Denim' }),
      item({ id: 'o2', title: 'T-Shirt', category: 'T-Shirt' }),
      item({ id: 'o3', title: 'Sneakers', category: 'Shoes' }),
    ];
    const result = scoreCategoryGaps(noOuter);
    expect(result.missingCategories).toContain('Outerwear');
  });

  it('scores full category coverage at 100', () => {
    const allCats = [
      item({ id: 'a1', title: 'Sneakers', category: 'Shoes' }),
      item({ id: 'a2', title: 'Overcoat', category: 'Coat' }),
      item({ id: 'a3', title: 'Shirt', category: 'Shirt' }),
      item({ id: 'a4', title: 'Trousers', category: 'Trousers' }),
      item({ id: 'a5', title: 'Crewneck Sweater', category: 'Knitwear' }),
    ];
    const result = scoreCategoryGaps(allCats);
    expect(result.score).toBe(100);
    expect(result.missingCategories).toHaveLength(0);
  });

  it('handles empty closet gracefully', () => {
    const result = scoreCategoryGaps([]);
    expect(result.score).toBe(0);
    expect(result.missingCategories.length).toBe(5);
  });
});

// ── Mix and Match ─────────────────────────────────────────────────────────────

describe('scoreMixAndMatch', () => {
  it('returns score 0 when no tops or bottoms', () => {
    const onlyShoes = [item({ id: 'm1', title: 'Sneakers', category: 'Shoes' })];
    const result = scoreMixAndMatch(onlyShoes);
    expect(result.score).toBe(0);
    expect(result.topCount).toBe(0);
  });

  it('estimates combinations correctly for small closet', () => {
    const small = [
      item({ id: 's1', title: 'White Shirt', category: 'Shirt' }),
      item({ id: 's2', title: 'Navy T-Shirt', category: 'T-Shirt' }),
      item({ id: 's3', title: 'Chinos', category: 'Trousers' }),
      item({ id: 's4', title: 'Jeans', category: 'Denim' }),
      item({ id: 's5', title: 'Sneakers', category: 'Shoes' }),
    ];
    const result = scoreMixAndMatch(small);
    expect(result.topCount).toBe(2);
    expect(result.bottomCount).toBe(2);
    expect(result.estimatedCombinations).toBe(4); // 2 tops × 2 bottoms
    expect(result.score).toBeGreaterThan(20);
  });

  it('rewards well-stocked wardrobe with layering options', () => {
    const rich = [
      ...Array.from({ length: 5 }, (_, i) => item({ id: `t${i}`, title: `Top ${i}`, category: 'Shirt' })),
      ...Array.from({ length: 4 }, (_, i) => item({ id: `b${i}`, title: `Bottom ${i}`, category: 'Trousers' })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `j${i}`, title: `Jacket ${i}`, category: 'Blazer' })),
      item({ id: 'shoe1', title: 'Sneakers', category: 'Shoes' }),
    ];
    const result = scoreMixAndMatch(rich);
    expect(result.estimatedCombinations).toBeGreaterThan(15);
    expect(result.score).toBeGreaterThan(60);
  });
});

// ── Composite Versatility ─────────────────────────────────────────────────────

describe('scoreVersatilityFunctionality', () => {
  it('returns score 0 for empty closet', () => {
    const result = scoreVersatilityFunctionality([], config);
    expect(result.score).toBe(0);
  });

  it('produces a score between 0 and 100', () => {
    const items = [
      item({ id: 'v1', title: 'White T-Shirt', category: 'T-Shirt', formality: 'casual', colorFamily: 'white' }),
      item({ id: 'v2', title: 'Navy Jeans', category: 'Denim', formality: 'casual', colorFamily: 'navy' }),
    ];
    const result = scoreVersatilityFunctionality(items, config);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('scores a well-balanced closet above 60', () => {
    const balanced = [
      item({ id: 'wv1', title: 'White Oxford Shirt',  category: 'Shirt',    formality: 'smart casual',  colorFamily: 'white' }),
      item({ id: 'wv2', title: 'Navy Suit Trousers',   category: 'Trousers', formality: 'business',      colorFamily: 'navy' }),
      item({ id: 'wv3', title: 'Grey Sweater',         category: 'Knitwear', formality: 'smart casual',  colorFamily: 'grey' }),
      item({ id: 'wv4', title: 'Dark Jeans',           category: 'Denim',    formality: 'casual',        colorFamily: 'navy' }),
      item({ id: 'wv5', title: 'White T-Shirt',        category: 'T-Shirt',  formality: 'casual',        colorFamily: 'white' }),
      item({ id: 'wv6', title: 'Navy Blazer',          category: 'Blazer',   formality: 'business',      colorFamily: 'navy' }),
      item({ id: 'wv7', title: 'Black Oxfords',        category: 'Shoes',    formality: 'business',      colorFamily: 'black' }),
      item({ id: 'wv8', title: 'White Sneakers',       category: 'Shoes',    formality: 'casual',        colorFamily: 'white' }),
      item({ id: 'wv9', title: 'Trench Coat',          category: 'Coat',     formality: 'smart casual',  colorFamily: 'camel' }),
    ];
    const result = scoreVersatilityFunctionality(balanced, config);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.strengthHighlights.length).toBeGreaterThan(0);
  });

  it('produces consistent scores for identical closets', () => {
    const items = [
      item({ id: 'cs1', title: 'Shirt', category: 'Shirt', formality: 'smart casual', colorFamily: 'white' }),
      item({ id: 'cs2', title: 'Jeans', category: 'Denim', formality: 'casual', colorFamily: 'navy' }),
    ];
    const r1 = scoreVersatilityFunctionality(items, config);
    const r2 = scoreVersatilityFunctionality(items, config);
    expect(r1.score).toBe(r2.score);
  });

  it('surface gap callouts for significant mismatches', () => {
    const weakCloset = [
      item({ id: 'gp1', title: 'White T-Shirt', category: 'T-Shirt', colorFamily: 'white' }),
    ];
    const result = scoreVersatilityFunctionality(weakCloset, config);
    expect(result.gapCallouts.length).toBeGreaterThan(0);
  });
});
