import { describe, expect, it } from 'vitest';

import { computeClosetHash, buildItemSignatures, buildDelta, type DeltaBuilderInput } from '../closet-wardrobe-analysis.service.js';
import type { ClosetAnalysisSnapshot } from '../closet-analysis.repository.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Phase R6D: characterizes the pure, previously-untested helper logic behind
// closetService.analyseCloset (computeClosetHash / buildItemSignatures /
// buildDelta) — no existing test covered any of this before this phase.
// These tests were written against closet.service.ts (with the three
// functions temporarily exported) BEFORE the whole-closet-analysis concern
// was extracted into closet-wardrobe-analysis.service.ts, then repointed to
// the new permanent location once the extraction landed — same tests, same
// assertions, proving the move didn't change behavior.
//
// runFullAnalysis/runAdvisoryOnly (the two AI-calling functions) are not
// characterized here — they're a thin two-attempt retry wrapper around
// openAiClient.createStructuredResponse with no branching logic of their own
// to protect beyond what a full AI-mocking integration test would require,
// which is out of proportion for a pure code-motion phase.

type Item = {
  title: string;
  category: string;
  subcategory?: string | null;
  colorFamily?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  material?: string | null;
  pattern?: string | null;
};

function item(overrides: Item): Item {
  return {
    subcategory: null,
    colorFamily: null,
    formality: null,
    silhouette: null,
    season: null,
    material: null,
    pattern: null,
    ...overrides,
  };
}

describe('computeClosetHash', () => {
  it('is stable for the same set of items regardless of input order', () => {
    const a = item({ title: 'Chinos', category: 'Trousers' });
    const b = item({ title: 'Tee', category: 'T-Shirt' });
    const hash1 = computeClosetHash([a, b] as any);
    const hash2 = computeClosetHash([b, a] as any);
    expect(hash1).toBe(hash2);
  });

  it('is case/whitespace-insensitive on title', () => {
    const a = item({ title: 'Chinos', category: 'Trousers' });
    const b = item({ title: '  CHINOS  ', category: 'Trousers' });
    expect(computeClosetHash([a] as any)).toBe(computeClosetHash([b] as any));
  });

  it('changes when a meaningfully different field changes (e.g. color family)', () => {
    const a = item({ title: 'Chinos', category: 'Trousers', colorFamily: 'Beige' });
    const b = item({ title: 'Chinos', category: 'Trousers', colorFamily: 'Navy' });
    expect(computeClosetHash([a] as any)).not.toBe(computeClosetHash([b] as any));
  });

  it('produces a 24-character hex string', () => {
    const hash = computeClosetHash([item({ title: 'Chinos', category: 'Trousers' })] as any);
    expect(hash).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe('buildItemSignatures', () => {
  it('returns "category|title" strings, sorted', () => {
    const items = [
      item({ title: 'Zebra Print Scarf', category: 'Scarf' }),
      item({ title: 'Chinos', category: 'Trousers' }),
    ];
    expect(buildItemSignatures(items as any)).toEqual(['Scarf|Zebra Print Scarf', 'Trousers|Chinos']);
  });

  it('trims the title but does not lowercase it (distinct from computeClosetHash)', () => {
    expect(buildItemSignatures([item({ title: '  Chinos  ', category: 'Trousers' })] as any)).toEqual(['Trousers|Chinos']);
  });
});

describe('buildDelta', () => {
  const baseInput: DeltaBuilderInput = {
    previous: null,
    currentTotalScore: 80,
    currentItemSignatures: ['Trousers|Chinos'],
    currentItemCount: 1,
    usedCache: false,
  };

  function snapshot(overrides: Partial<ClosetAnalysisSnapshot>): ClosetAnalysisSnapshot {
    return {
      id: 'snap-1',
      supabaseUserId: 'user-1',
      closetHash: 'hash-1',
      itemCount: 1,
      totalScore: 70,
      subScores: { formality_range: 1, color_versatility: 1, seasonal_coverage: 1, layering_options: 1, occasion_coverage: 1 },
      summary: 'prev summary',
      deficientCategory: 'none',
      excessCategory: 'none',
      itemSignatures: ['Trousers|Chinos'],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('first analysis (no previous snapshot): direction "first", zero points, null previous_score', () => {
    const result = buildDelta(baseInput);
    expect(result).toEqual({
      direction: 'first',
      points: 0,
      previous_score: null,
      summary: 'First closet analysis — this becomes the baseline for future comparisons.',
    });
  });

  it('cache hit with identical score: direction "same", explicit "unchanged" summary', () => {
    const result = buildDelta({
      ...baseInput,
      previous: snapshot({ totalScore: 80 }),
      currentTotalScore: 80,
      usedCache: true,
    });
    expect(result.direction).toBe('same');
    expect(result.points).toBe(0);
    expect(result.previous_score).toBe(80);
    expect(result.summary).toBe('Your score is unchanged because your closet has not changed since the last analysis.');
  });

  it('score improved with items added: direction "up", mentions the added item by name', () => {
    const result = buildDelta({
      previous: snapshot({ totalScore: 70, itemSignatures: ['Trousers|Chinos'] }),
      currentTotalScore: 85,
      currentItemSignatures: ['Trousers|Chinos', 'T-Shirt|Tee'],
      currentItemCount: 2,
      usedCache: false,
    });
    expect(result.direction).toBe('up');
    expect(result.points).toBe(15);
    expect(result.previous_score).toBe(70);
    expect(result.summary).toContain('improved');
    expect(result.summary).toContain('Tee');
  });

  it('score dropped with items removed: direction "down", mentions the removed item by name', () => {
    const result = buildDelta({
      previous: snapshot({ totalScore: 90, itemSignatures: ['Trousers|Chinos', 'T-Shirt|Tee'] }),
      currentTotalScore: 75,
      currentItemSignatures: ['Trousers|Chinos'],
      currentItemCount: 1,
      usedCache: false,
    });
    expect(result.direction).toBe('down');
    expect(result.points).toBe(15);
    expect(result.summary).toContain('dropped');
    expect(result.summary).toContain('Tee');
  });

  it('both additions and removals: reason mentions counts of each, not names', () => {
    const result = buildDelta({
      previous: snapshot({ totalScore: 80, itemSignatures: ['Trousers|Chinos'] }),
      currentTotalScore: 82,
      currentItemSignatures: ['T-Shirt|Tee'],
      currentItemCount: 1,
      usedCache: false,
    });
    expect(result.summary).toContain('1 addition');
    expect(result.summary).toContain('1 removal');
  });

  it('score changed with no item-level diff: falls back to "updates to existing items"', () => {
    const result = buildDelta({
      previous: snapshot({ totalScore: 80, itemSignatures: ['Trousers|Chinos'] }),
      currentTotalScore: 85,
      currentItemSignatures: ['Trousers|Chinos'],
      currentItemCount: 1,
      usedCache: false,
    });
    expect(result.summary).toContain('updates to existing items');
  });

  it('more than 3 added items: names the first 3 and counts the rest', () => {
    const result = buildDelta({
      previous: snapshot({ totalScore: 70, itemSignatures: [] }),
      currentTotalScore: 90,
      currentItemSignatures: ['A|One', 'B|Two', 'C|Three', 'D|Four'],
      currentItemCount: 4,
      usedCache: false,
    });
    expect(result.summary).toContain('One');
    expect(result.summary).toContain('Two');
    expect(result.summary).toContain('Three');
    expect(result.summary).toContain('and 1 more');
    expect(result.summary).not.toContain('Four');
  });
});
