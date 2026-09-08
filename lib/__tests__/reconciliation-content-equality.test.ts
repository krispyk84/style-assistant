import { describe, expect, it } from 'vitest';

import { canonicalDeepEqual } from '@/lib/reconciliation-content-equality';

describe('canonicalDeepEqual', () => {
  it('treats differently-ordered keys as equal (the whole reason this exists over JSON.stringify)', () => {
    expect(canonicalDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('detects a genuinely different nested value', () => {
    expect(canonicalDeepEqual({ a: { x: 1 } }, { a: { x: 2 } })).toBe(false);
  });

  it('detects a different key set', () => {
    expect(canonicalDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('compares arrays positionally, order matters', () => {
    expect(canonicalDeepEqual([1, 2], [2, 1])).toBe(false);
    expect(canonicalDeepEqual([1, 2], [1, 2])).toBe(true);
  });

  it('null and undefined are not interchangeable', () => {
    expect(canonicalDeepEqual(null, undefined)).toBe(false);
  });

  it('deeply nested objects with reordered keys at every level are equal', () => {
    const a = { outer: { z: 1, y: [{ q: 1, p: 2 }] }, id: 'x' };
    const b = { id: 'x', outer: { y: [{ p: 2, q: 1 }], z: 1 } };
    expect(canonicalDeepEqual(a, b)).toBe(true);
  });
});
