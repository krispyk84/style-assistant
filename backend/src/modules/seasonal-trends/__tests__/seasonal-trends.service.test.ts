import { describe, it, expect, vi, beforeEach } from 'vitest';

const findCurrent = vi.fn();
const findMostRecentValid = vi.fn();
const createValid = vi.fn();
const createInvalid = vi.fn();

vi.mock('../seasonal-trends.repository.js', () => ({
  seasonalTrendsRepository: { findCurrent, findMostRecentValid, createValid, createInvalid },
}));

const generateStructuredContent = vi.fn();

vi.mock('../../../ai/gemini-text-client.js', () => ({
  geminiTextClient: { generateStructuredContent },
}));

const { seasonalTrendsService } = await import('../seasonal-trends.service.js');

function validGeminiResponse() {
  const trend = (rank: number, name: string) => ({
    rank,
    name,
    summary: 's',
    whyItMattersNow: 'w',
    garmentCategories: ['Trousers'],
    silhouettes: ['Straight'],
    colours: ['Navy'],
    materialsOrTextures: ['Wool'],
    footwear: ['Loafers'],
    accessories: ['Belt'],
    stylingRules: ['Rule'],
    avoid: ['Avoid'],
    trendStrength: 7,
    lifecycle: 'current',
    versatility: 8,
    confidence: 0.8,
  });
  const tenTrends = (prefix: string) => Array.from({ length: 10 }, (_, i) => trend(i + 1, `${prefix} ${i + 1}`));
  return {
    season: 'fall',
    year: 2026,
    fashionGender: 'menswear',
    region: 'North America',
    generatedAt: new Date().toISOString(),
    business: tenTrends('Business'),
    smartCasual: tenTrends('SmartCasual'),
    casual: tenTrends('Casual'),
  };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  findCurrent.mockReset();
  findMostRecentValid.mockReset();
  createValid.mockReset();
  createInvalid.mockReset();
  generateStructuredContent.mockReset();
});

describe('getCurrentTrendProfile', () => {
  it('returns the exact-match profile with isStale=false when one exists', async () => {
    findCurrent.mockResolvedValue({ id: 'p1' });
    const result = await seasonalTrendsService.getCurrentTrendProfile('menswear', 'northern');
    expect(result).toEqual({ profile: { id: 'p1' }, isStale: false });
    expect(findMostRecentValid).not.toHaveBeenCalled();
  });

  it('falls back to the most recent valid profile with isStale=true when no exact match exists', async () => {
    findCurrent.mockResolvedValue(null);
    findMostRecentValid.mockResolvedValue({ id: 'stale-1' });
    const result = await seasonalTrendsService.getCurrentTrendProfile('menswear', 'northern');
    expect(result).toEqual({ profile: { id: 'stale-1' }, isStale: true });
  });

  it('returns null when there is no current and no stale profile', async () => {
    findCurrent.mockResolvedValue(null);
    findMostRecentValid.mockResolvedValue(null);
    const result = await seasonalTrendsService.getCurrentTrendProfile('menswear', 'northern');
    expect(result).toBeNull();
  });

  it('never calls Gemini — it is a pure DB read', async () => {
    findCurrent.mockResolvedValue(null);
    findMostRecentValid.mockResolvedValue(null);
    await seasonalTrendsService.getCurrentTrendProfile('menswear', 'northern');
    expect(generateStructuredContent).not.toHaveBeenCalled();
  });
});

describe('ensureCurrentProfile', () => {
  it('does not call Gemini when a current valid profile already exists', async () => {
    findCurrent.mockResolvedValue({ id: 'already-here' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).not.toHaveBeenCalled();
  });

  it('requests and persists a new profile when none exists for the current season', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
    expect(createValid).toHaveBeenCalledTimes(1);
    expect(createInvalid).not.toHaveBeenCalled();
  });

  it('does not block the caller — returns synchronously, not a Promise', () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    const result = seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    expect(result).toBeUndefined();
  });

  it('dedupes concurrent calls for the same season/gender/hemisphere — only one Gemini request fires', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
    expect(findCurrent).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe across different fashionGender/hemisphere keys', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'womenswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
  });

  it('stores an invalid record and does NOT touch createValid when the Gemini response fails schema validation', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue({ nonsense: true });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(createInvalid).toHaveBeenCalledTimes(1);
    expect(createValid).not.toHaveBeenCalled();
  });

  it('does not touch createValid or createInvalid when the Gemini request itself throws (network failure)', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockRejectedValue(new Error('network down'));
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(createValid).not.toHaveBeenCalled();
    expect(createInvalid).not.toHaveBeenCalled();
  });

  it('allows a later ensure() call for the same key to retry once the prior attempt has settled', async () => {
    findCurrent.mockResolvedValue(null);
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
  });
});

describe('forceRefresh', () => {
  it('requests Gemini even when a current valid profile already exists', async () => {
    findCurrent.mockResolvedValue({ id: 'already-here' });
    generateStructuredContent.mockResolvedValue(validGeminiResponse());
    seasonalTrendsService.forceRefresh({ fashionGender: 'menswear', hemisphere: 'northern' });
    await flushMicrotasks();
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
    expect(createValid).toHaveBeenCalledTimes(1);
  });
});
