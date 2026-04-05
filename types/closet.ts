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

  // ── Usage counters (AsyncStorage only, not persisted to DB) ───────────────
  anchorToOutfitCount?: number;
  matchedToRecommendationCount?: number;
};
