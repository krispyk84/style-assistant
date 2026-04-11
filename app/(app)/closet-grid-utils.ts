import type { ClosetItem } from '@/types/closet';

export const COLUMN_COUNT = 3;

// A row in the grid — up to COLUMN_COUNT items
export type ClosetRow = ClosetItem[];

export type ClosetSection = { title: string; data: ClosetRow[] };

export type CategoryEntry = { label: string; count: number };

export function chunkIntoRows(items: ClosetItem[]): ClosetRow[] {
  const rows: ClosetRow[] = [];
  for (let i = 0; i < items.length; i += COLUMN_COUNT) {
    rows.push(items.slice(i, i + COLUMN_COUNT));
  }
  return rows;
}

export function groupByCategory(items: ClosetItem[]): Record<string, ClosetItem[]> {
  const groups: Record<string, ClosetItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat]!.push(item);
  }
  return groups;
}

export function buildCategories(items: ClosetItem[]): CategoryEntry[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
