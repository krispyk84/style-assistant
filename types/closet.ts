export type ClosetItemSketchStatus = 'pending' | 'ready' | 'failed';

// ── Personal Fit Status ────────────────────────────────────────────────────────
// How the item fits the wearer right now (not the garment's design cut).

export type ClosetItemFitStatus =
  | 'fits-well'
  | 'tailored'
  | 'too-tight'
  | 'fits-large'
  | 'needs-alteration';

export const CLOSET_FIT_STATUS_OPTIONS: { value: ClosetItemFitStatus; label: string }[] = [
  { value: 'fits-well', label: 'Fits Well' },
  { value: 'tailored', label: 'Tailored' },
  { value: 'too-tight', label: 'Too Tight' },
  { value: 'fits-large', label: 'Fits Large' },
  { value: 'needs-alteration', label: 'Needs Alteration' },
];

// ── Silhouette / Design Cut ────────────────────────────────────────────────────
// The garment's designed silhouette — independent of how it fits the wearer.

export type ClosetItemSilhouette =
  | 'slim'
  | 'straight'
  | 'relaxed'
  | 'oversized'
  | 'cropped';

export const CLOSET_SILHOUETTE_OPTIONS: { value: ClosetItemSilhouette; label: string }[] = [
  { value: 'slim', label: 'Slim' },
  { value: 'straight', label: 'Straight' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'cropped', label: 'Cropped' },
];

// ── Color Family ───────────────────────────────────────────────────────────────
// Broad color grouping for matching — aligns with COLOR_FAMILIES in closet-match.ts.

export type ClosetItemColorFamily =
  | 'white'
  | 'stone'
  | 'grey'
  | 'black'
  | 'navy'
  | 'blue'
  | 'brown'
  | 'olive'
  | 'green'
  | 'burgundy'
  | 'red'
  | 'pink'
  | 'yellow'
  | 'purple'
  | 'rust'
  | 'camel';

export const CLOSET_COLOR_FAMILY_OPTIONS: { value: ClosetItemColorFamily; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'stone', label: 'Stone' },
  { value: 'camel', label: 'Camel' },
  { value: 'grey', label: 'Grey' },
  { value: 'black', label: 'Black' },
  { value: 'navy', label: 'Navy' },
  { value: 'blue', label: 'Blue' },
  { value: 'brown', label: 'Brown' },
  { value: 'olive', label: 'Olive' },
  { value: 'green', label: 'Green' },
  { value: 'burgundy', label: 'Burgundy' },
  { value: 'red', label: 'Red' },
  { value: 'pink', label: 'Pink' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'purple', label: 'Purple' },
  { value: 'rust', label: 'Rust' },
];

export const CLOSET_FORMALITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'Casual', label: 'Casual' },
  { value: 'Smart Casual', label: 'Smart Casual' },
  { value: 'Refined Casual', label: 'Refined Casual' },
  { value: 'Formal', label: 'Formal' },
];

export const CLOSET_WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: 'Lightweight', label: 'Lightweight' },
  { value: 'Midweight', label: 'Midweight' },
  { value: 'Heavyweight', label: 'Heavyweight' },
];

export const CLOSET_PATTERN_OPTIONS: { value: string; label: string }[] = [
  { value: 'Solid', label: 'Solid' },
  { value: 'Stripe', label: 'Stripe' },
  { value: 'Check', label: 'Check' },
  { value: 'Plaid', label: 'Plaid' },
  { value: 'Print', label: 'Print' },
  { value: 'Texture', label: 'Texture' },
  { value: 'Other', label: 'Other' },
];

export const CLOSET_SEASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'All Season', label: 'All Season' },
  { value: 'Spring', label: 'Spring' },
  { value: 'Summer', label: 'Summer' },
  { value: 'Fall', label: 'Fall' },
  { value: 'Winter', label: 'Winter' },
];

// ── Sunglasses — Lens Shape ────────────────────────────────────────────────────

export type ClosetItemLensShape =
  | 'aviator'
  | 'wayfarer'
  | 'round'
  | 'square'
  | 'cat_eye'
  | 'oversized'
  | 'shield'
  | 'wraparound';

export const CLOSET_LENS_SHAPE_OPTIONS: { value: ClosetItemLensShape; label: string }[] = [
  { value: 'aviator', label: 'Aviator' },
  { value: 'wayfarer', label: 'Wayfarer' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'cat_eye', label: 'Cat Eye' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'shield', label: 'Shield' },
  { value: 'wraparound', label: 'Wraparound' },
];

// ── Sunglasses — Frame Color ───────────────────────────────────────────────────

export type ClosetItemFrameColor =
  | 'black'
  | 'tortoise'
  | 'gold'
  | 'silver'
  | 'clear'
  | 'brown'
  | 'navy'
  | 'white'
  | 'pink'
  | 'green'
  | 'red';

export const CLOSET_FRAME_COLOR_OPTIONS: { value: ClosetItemFrameColor; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'tortoise', label: 'Tortoise' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'clear', label: 'Clear' },
  { value: 'brown', label: 'Brown' },
  { value: 'navy', label: 'Navy' },
  { value: 'white', label: 'White' },
  { value: 'pink', label: 'Pink' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
];

// ── Closet Item ────────────────────────────────────────────────────────────────

export type ClosetItem = {
  id: string;
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageUrl: string | null;
  sketchImageUrl: string | null;
  sketchStatus: ClosetItemSketchStatus;
  savedAt: string;

  // ── Design metadata (AI-filled, used for matching) ─────────────────────────
  subcategory?: string | null;
  primaryColor?: string | null;
  colorFamily?: ClosetItemColorFamily | null;
  material?: string | null;
  formality?: string | null;
  silhouette?: ClosetItemSilhouette | null;
  season?: string | null;
  weight?: string | null;
  pattern?: string | null;
  notes?: string | null;

  // ── Personal fit (user-set) ────────────────────────────────────────────────
  /** How the item fits the wearer personally — separate from the garment's design silhouette. */
  fitStatus?: ClosetItemFitStatus | null;

  // ── Sunglasses-specific ────────────────────────────────────────────────────
  lensShape?: ClosetItemLensShape | null;
  frameColor?: ClosetItemFrameColor | null;

  // ── Usage counters (local AsyncStorage) ───────────────────────────────────
  anchorToOutfitCount?: number;
  matchedToRecommendationCount?: number;

  // ── Usage counters (backend DB) ────────────────────────────────────────────
  anchorCount?: number;
  matchCount?: number;
};
