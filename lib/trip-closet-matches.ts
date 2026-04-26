import { findBestClosetMatch } from '@/lib/closet-match';
import type { ClosetItem } from '@/types/closet';

export function buildMatchedItemNameSet(
  itemNames: string[],
  closetItems: ClosetItem[] | undefined,
): Set<string> {
  if (!closetItems?.length) return new Set<string>();

  const matched = new Set<string>();
  for (const itemName of itemNames) {
    if (itemName && findBestClosetMatch(itemName, closetItems)) {
      matched.add(itemName);
    }
  }
  return matched;
}
