import type { ClosetOutfitIndexItem } from '../../ai/prompts/closet-outfits.prompts.js';
import { closetRepository } from './closet.repository.js';

// Shared by closet-outfits.service.ts ("Generate 5 Outfits") and
// trips.service.ts's "From My Closet" trip mode — both need the same
// wardrobe-index-as-JSON pattern (hand the model the full closet, require it
// to reference real item ids, never let it invent pieces). Extracted here so
// there's exactly one place that builds this index, not two copies.

export type ClosetIndexResult<TItem> = {
  index: ClosetOutfitIndexItem[];
  itemsById: Map<string, TItem>;
};

export async function buildClosetIndex(supabaseUserId: string) {
  const items = await closetRepository.getItems(supabaseUserId);

  // Shuffled per request — LLMs skew toward items earlier in a long list, so
  // sending the same order every time compounds that bias into the same
  // handful of items getting picked call after call regardless of prompt
  // instructions.
  const shuffled = [...items].sort(() => Math.random() - 0.5);

  const index: ClosetOutfitIndexItem[] = shuffled.map((item) => ({
    id: item.id,
    name: item.title,
    category: item.category,
    color_family: item.colorFamily ?? null,
    formality: item.formality ?? null,
    silhouette: item.silhouette ?? null,
    season: item.season ?? null,
    material: item.material ?? null,
    brand: item.brand || null,
  }));

  const itemsById = new Map(items.map((item) => [item.id, item]));

  return { index, itemsById };
}
