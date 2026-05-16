import type { ClosetItem } from '@/types/closet';

export type ClosetSearchResult = {
  item: ClosetItem;
  score: number;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreToken(haystack: string, token: string): number {
  if (!haystack || !token) return 0;
  const idx = haystack.indexOf(token);
  if (idx < 0) return 0;
  if (idx === 0) return token.length === haystack.length ? 4 : 3;
  const prevChar = haystack[idx - 1];
  if (prevChar === ' ' || prevChar === '-' || prevChar === '/') return 2;
  return 1;
}

function scoreItem(item: ClosetItem, tokens: string[]): number {
  const brand = normalize(item.brand);
  const title = normalize(item.title);
  let total = 0;
  for (const token of tokens) {
    const brandScore = scoreToken(brand, token);
    const titleScore = scoreToken(title, token);
    const best = Math.max(brandScore, titleScore);
    if (best === 0) return 0;
    total += best * 2 + brandScore;
  }
  return total;
}

/**
 * Live-search the closet by free-text query against brand + title only.
 * Returns items ordered by best match (brand-prefix > word-boundary > substring > anywhere).
 * Empty query returns [].
 */
export function searchClosetItems(items: ClosetItem[], query: string): ClosetItem[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored: ClosetSearchResult[] = [];
  for (const item of items) {
    const score = scoreItem(item, tokens);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.title.localeCompare(b.item.title);
  });
  return scored.map((entry) => entry.item);
}
