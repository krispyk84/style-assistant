import { describe, it, expect, beforeAll } from 'vitest';
import { loadScoringConfig } from '../scoring-config.js';
import { scoreEssentialsCoverage } from '../essentials-coverage.service.js';
import type { ScoringConfig } from '../scoring-config.js';
import type { ScoringClosetItem } from '../wardrobe-score.types.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function item(overrides: Partial<ScoringClosetItem> & { id: string; title: string; category: string }): ScoringClosetItem {
  return {
    subcategory: null,
    brand: null,
    primaryColor: null,
    colorFamily: null,
    material: null,
    formality: null,
    silhouette: null,
    pattern: null,
    weight: null,
    ...overrides,
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

let config: ScoringConfig;

beforeAll(() => {
  config = loadScoringConfig();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadScoringConfig', () => {
  it('loads without throwing', () => {
    expect(config).toBeDefined();
    expect(config.scoringVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('dimension weights sum to approximately 1', () => {
    const { essentialsCoverage, versatilityFunctionality, trendRelevance } = config.dimensionWeights;
    const sum = essentialsCoverage + versatilityFunctionality + trendRelevance;
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('tier weights sum to approximately 1', () => {
    const { tier1, tier2, tier3 } = config.essentialsTierWeights;
    const sum = tier1 + tier2 + tier3;
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('has at least 10 tier-1 essentials', () => {
    expect(config.essentialsMasterList.tier1.length).toBeGreaterThanOrEqual(10);
  });

  it('has at least 8 tier-2 essentials', () => {
    expect(config.essentialsMasterList.tier2.length).toBeGreaterThanOrEqual(8);
  });

  it('all essential IDs are unique', () => {
    const ids = [
      ...config.essentialsMasterList.tier1,
      ...config.essentialsMasterList.tier2,
      ...config.essentialsMasterList.tier3,
    ].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('scoreEssentialsCoverage — empty closet', () => {
  it('returns score 0 for empty closet', () => {
    const result = scoreEssentialsCoverage([], config);
    expect(result.score).toBe(0);
    expect(result.matchedCount).toBe(0);
    expect(result.missingTier1.length).toBeGreaterThan(0);
  });

  it('returns gap callouts for missing tier-1 items', () => {
    const result = scoreEssentialsCoverage([], config);
    expect(result.gapCallouts.length).toBeGreaterThan(0);
    expect(result.gapCallouts.some((c) => c.toLowerCase().includes('missing'))).toBe(true);
  });
});

describe('scoreEssentialsCoverage — exact matches', () => {
  it('matches a white dress shirt exactly', () => {
    const items = [item({ id: '1', title: 'White Oxford Shirt', category: 'Shirt', subcategory: 'OCBD', colorFamily: 'white' })];
    const result = scoreEssentialsCoverage(items, config);
    const match = result.matches.find((m) => m.essentialId === 'white-dress-shirt');
    expect(match?.matchType).toBe('exact');
  });

  it('matches dark jeans correctly', () => {
    const items = [item({ id: '2', title: 'Slim Navy Jeans', category: 'Denim', colorFamily: 'navy' })];
    const result = scoreEssentialsCoverage(items, config);
    const match = result.matches.find((m) => m.essentialId === 'dark-wash-jeans');
    expect(['exact', 'strong', 'partial']).toContain(match?.matchType);
  });

  it('matches leather Oxford shoes correctly', () => {
    const items = [item({ id: '3', title: 'Black Oxford Dress Shoes', category: 'Shoes', subcategory: 'Oxford', colorFamily: 'black' })];
    const result = scoreEssentialsCoverage(items, config);
    const match = result.matches.find((m) => m.essentialId === 'leather-dress-shoe');
    expect(['exact', 'strong']).toContain(match?.matchType);
  });

  it('does NOT match navy Derby as a white sneaker essential', () => {
    const items = [item({ id: '4', title: 'Navy Derby Shoe', category: 'Shoes', subcategory: 'Derby', colorFamily: 'navy' })];
    const result = scoreEssentialsCoverage(items, config);
    const whiteSneakerMatch = result.matches.find((m) => m.essentialId === 'white-clean-sneaker');
    expect(whiteSneakerMatch?.matchType).toBe('none');
  });
});

describe('scoreEssentialsCoverage — partial matches and keyword matching', () => {
  it('matches chinos via keyword when subcategory is missing', () => {
    const items = [item({ id: '5', title: 'Slim Chinos', category: 'Trousers' })];
    const result = scoreEssentialsCoverage(items, config);
    const match = result.matches.find((m) => m.essentialId === 'chino-trousers');
    expect(['strong', 'partial']).toContain(match?.matchType);
  });

  it('matches grey sweater via color family and category', () => {
    const items = [item({ id: '6', title: 'Grey Merino Crewneck', category: 'Knitwear', colorFamily: 'grey', subcategory: 'Crewneck' })];
    const result = scoreEssentialsCoverage(items, config);
    const match = result.matches.find((m) => m.essentialId === 'grey-crewneck-sweater');
    expect(['exact', 'strong']).toContain(match?.matchType);
  });
});

describe('scoreEssentialsCoverage — well-covered closet', () => {
  const wellCoveredItems: ScoringClosetItem[] = [
    item({ id: 'c1',  title: 'White OCBD Shirt',      category: 'Shirt',    subcategory: 'OCBD',    colorFamily: 'white' }),
    item({ id: 'c2',  title: 'White Crew-Neck Tee',   category: 'T-Shirt',                          colorFamily: 'white' }),
    item({ id: 'c3',  title: 'Dark Indigo Slim Jeans', category: 'Denim',   subcategory: 'Slim',    colorFamily: 'navy' }),
    item({ id: 'c4',  title: 'Slim Tan Chinos',        category: 'Trousers', subcategory: 'Chino' }),
    item({ id: 'c5',  title: 'Navy Blazer',            category: 'Blazer',                          colorFamily: 'navy' }),
    item({ id: 'c6',  title: 'Grey Merino Crewneck',   category: 'Knitwear', subcategory: 'Crewneck', colorFamily: 'grey' }),
    item({ id: 'c7',  title: 'Black Oxford Shoes',     category: 'Shoes',   subcategory: 'Oxford',  colorFamily: 'black' }),
    item({ id: 'c8',  title: 'White Low-Top Sneakers', category: 'Shoes',   subcategory: 'Sneakers', colorFamily: 'white' }),
    item({ id: 'c9',  title: 'Navy Two-Piece Suit',    category: 'Suit',    formality: 'business-formal', colorFamily: 'navy' }),
    item({ id: 'c10', title: 'Navy Tailored Trousers', category: 'Trousers', colorFamily: 'navy' }),
    item({ id: 'c11', title: 'Black Leather Belt',     category: 'Belt',                            colorFamily: 'black' }),
    item({ id: 'c12', title: 'Wool Overcoat',          category: 'Coat' }),
  ];

  it('scores significantly above 60 for a well-covered closet', () => {
    const result = scoreEssentialsCoverage(wellCoveredItems, config);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('has high tier-1 match rate for a well-covered closet', () => {
    const result = scoreEssentialsCoverage(wellCoveredItems, config);
    expect(result.tier1MatchRate).toBeGreaterThanOrEqual(0.7);
  });

  it('returns strength highlights for good coverage', () => {
    const result = scoreEssentialsCoverage(wellCoveredItems, config);
    expect(result.strengthHighlights.length).toBeGreaterThan(0);
  });
});

describe('scoreEssentialsCoverage — score consistency', () => {
  it('identical closet produces identical score', () => {
    const items: ScoringClosetItem[] = [
      item({ id: 'x1', title: 'White T-Shirt', category: 'T-Shirt', colorFamily: 'white' }),
      item({ id: 'x2', title: 'Navy Jeans', category: 'Denim', colorFamily: 'navy' }),
    ];
    const r1 = scoreEssentialsCoverage(items, config);
    const r2 = scoreEssentialsCoverage(items, config);
    expect(r1.score).toBe(r2.score);
    expect(r1.matchedCount).toBe(r2.matchedCount);
  });

  it('score is between 0 and 100', () => {
    const randomItems: ScoringClosetItem[] = [
      item({ id: 'r1', title: 'Random Garment', category: 'Unknown' }),
    ];
    const result = scoreEssentialsCoverage(randomItems, config);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('scoreEssentialsCoverage — graceful degradation', () => {
  it('handles items with all null metadata', () => {
    const items = [item({ id: 'n1', title: 'Something', category: 'Clothing' })];
    expect(() => scoreEssentialsCoverage(items, config)).not.toThrow();
  });

  it('handles items with unusual category values', () => {
    const items = [
      item({ id: 'u1', title: 'Custom Item', category: '' }),
      item({ id: 'u2', title: 'Another Item', category: 'CUSTOM_CATEGORY_XYZ' }),
    ];
    const result = scoreEssentialsCoverage(items, config);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
