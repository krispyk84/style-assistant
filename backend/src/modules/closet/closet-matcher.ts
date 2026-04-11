import type { ClosetMatchPayload } from './closet.validation.js';

type MatchItem = ClosetMatchPayload['items'][number];
type MatchSuggestion = ClosetMatchPayload['suggestions'][number];

// ── OutfitPieceCategory → closet item category mapping ────────────────────────
// Maps the structured category enum (from the LLM's structured output) to the
// closet item category strings stored in the DB. Used to pre-filter candidates
// before the LLM matching step so category is a hard gate, not inferred from text.

export const OUTFIT_TO_CLOSET_CATEGORY_MAP: Record<string, string[]> = {
  Bag:               ['Bag'],
  Belt:              ['Belt'],
  Blazer:            ['Blazer', 'Sports Jacket'],
  Boots:             ['Boots'],
  Cardigan:          ['Cardigan'],
  Coat:              ['Coat'],
  Denim:             ['Denim'],
  Gloves:            ['Gloves'],
  Hoodie:            ['Hoodie'],
  Knitwear:          ['Knitwear'],
  Loafers:           ['Loafers'],
  Outerwear:         ['Outerwear', 'Jacket'],
  Overshirt:         ['Overshirt'],
  Polo:              ['Polo'],
  Scarf:             ['Scarf'],
  Shirt:             ['Shirt'],
  Shoes:             ['Shoes'],
  Shorts:            ['Shorts'],
  Sneakers:          ['Sneakers'],
  Suit:              ['Suit'],
  Sunglasses:        ['Sunglasses'],
  Sweatpants:        ['Sweatpants'],
  Sweatshirt:        ['Sweatshirt'],
  'Swim Shirt':      ['Swim Shirt'],
  'Swimming Shorts': ['Swimming Shorts', 'Shorts'],
  'T-Shirt':         ['T-Shirt'],
  'Tank Top':        ['Tank Top'],
  Trousers:          ['Trousers'],
  Vest:              ['Vest'],
  Watch:             ['Watch'],
};

export function filterCandidatesPerSuggestion(
  suggestions: MatchSuggestion[],
  availableItems: MatchItem[],
): MatchItem[][] {
  return suggestions.map((s) => {
    if (!s.category) return availableItems;
    const compatibleCategories = OUTFIT_TO_CLOSET_CATEGORY_MAP[s.category];
    if (!compatibleCategories) return availableItems;
    const filtered = availableItems.filter((item) => compatibleCategories.includes(item.category));
    // If no items survive the category filter, return empty (LLM should return null)
    return filtered;
  });
}

export function buildCandidateItemsForLlm(
  availableItems: MatchItem[],
  candidatesPerSuggestion: MatchItem[][],
): MatchItem[] {
  const candidateItemIds = new Set(candidatesPerSuggestion.flatMap((c) => c.map((i) => i.id)));
  return availableItems.filter((item) => candidateItemIds.has(item.id));
}
