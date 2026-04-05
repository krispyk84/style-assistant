import type { ClosetItemFitStatus } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import type { WeatherContext } from '@/types/weather';

export const LOOK_TIER_OPTIONS = ['business', 'smart-casual', 'casual'] as const;

export type LookTierSlug = (typeof LOOK_TIER_OPTIONS)[number];

// ── Outfit piece taxonomy ──────────────────────────────────────────────────────

/**
 * Canonical set of outfit piece categories.
 * These map directly to closet item categories so the matching pipeline
 * can use an exact-category gate instead of inferring types from free text.
 *
 * Added: Suit, Shorts (both well-represented in the existing closet system).
 * Deferred: Jewelry (not in closet), Headwear (use Scarf; Hat exists in closet
 *   but is rarely a headline recommendation piece).
 */
export const OUTFIT_PIECE_CATEGORIES = [
  'Bag', 'Belt', 'Blazer', 'Boots', 'Cardigan', 'Coat', 'Denim', 'Gloves',
  'Hoodie', 'Knitwear', 'Loafers', 'Outerwear', 'Overshirt', 'Polo', 'Scarf',
  'Shirt', 'Shoes', 'Shorts', 'Sneakers', 'Suit', 'Sunglasses', 'Sweatpants',
  'Sweatshirt', 'Swim Shirt', 'Swimming Shorts', 'T-Shirt', 'Tank Top', 'Trousers',
  'Vest', 'Watch',
] as const;

export type OutfitPieceCategory = (typeof OUTFIT_PIECE_CATEGORIES)[number];
export type OutfitPieceFormality = 'Casual' | 'Smart Casual' | 'Refined Casual' | 'Formal';

export type OutfitPieceMeta = {
  category: OutfitPieceCategory;
  color: string;
  material?: string | null;
  formality: OutfitPieceFormality;
};

export type OutfitPiece = {
  /** Human-readable display text shown in the UI. */
  display_name: string;
  /**
   * Structured matching metadata. null for pieces generated before the
   * structured-output upgrade — text-based matching is used as fallback.
   */
  metadata: OutfitPieceMeta | null;
};

/** Normalises a value that may be a legacy plain string or a structured OutfitPiece. */
export function normalizePiece(piece: OutfitPiece | string): OutfitPiece {
  if (typeof piece === 'string') return { display_name: piece, metadata: null };
  return piece;
}

/**
 * Maps an OutfitPieceCategory to the closet item category strings that should
 * be treated as equivalent for matching. Covers legacy category names that may
 * exist in stored closet items (e.g. "Jacket" predates "Outerwear").
 */
export const OUTFIT_TO_CLOSET_CATEGORY_MAP: Readonly<Record<OutfitPieceCategory, readonly string[]>> = {
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

// ── Look input / recommendation types ─────────────────────────────────────────

export type LookAnchorItem = {
  id: string;
  description: string;
  image: LocalImageAsset | null;
  uploadedImage: UploadedImageAsset | null;
  fitStatus?: ClosetItemFitStatus;
};

export type CreateLookInput = {
  anchorItems: LookAnchorItem[];
  anchorItemDescription: string;
  vibeKeywords?: string;
  anchorImage: LocalImageAsset | null;
  uploadedAnchorImage: UploadedImageAsset | null;
  photoPending: boolean;
  selectedTiers: LookTierSlug[];
  weatherContext?: WeatherContext | null;
};

export type LookTierDefinition = {
  slug: LookTierSlug;
  label: string;
  shortDescription: string;
  positioning: string;
  bestFor: string[];
  palette: string[];
};

export type LookRecommendation = {
  tier: LookTierSlug;
  title: string;
  anchorItem: string;
  keyPieces: OutfitPiece[];
  shoes: OutfitPiece[];
  accessories: OutfitPiece[];
  fitNotes: string[];
  whyItWorks: string;
  stylingDirection: string;
  detailNotes: string[];
  sketchStatus?: 'pending' | 'ready' | 'failed';
  sketchImageUrl?: string | null;
  sketchStorageKey?: string | null;
  sketchMimeType?: string | null;
};

export type LookRequestResponse = {
  requestId: string;
  status: 'completed';
  generatedAt: string;
  input: CreateLookInput;
  recommendations: LookRecommendation[];
};
