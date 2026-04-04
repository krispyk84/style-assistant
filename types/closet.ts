export type ClosetItemSketchStatus = 'pending' | 'ready' | 'failed';

export type ClosetItemFitStatus =
  | 'tailored'
  | 'slim'
  | 'regular'
  | 'relaxed'
  | 'oversized'
  | 'too-tight'
  | 'too-large';

export const CLOSET_FIT_STATUS_OPTIONS: { value: ClosetItemFitStatus; label: string }[] = [
  { value: 'tailored', label: 'Tailored' },
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'too-tight', label: 'Too Tight' },
  { value: 'too-large', label: 'Too Large' },
];

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
  /** How the item fits — used to inform outfit generation and sketch context. */
  fitStatus?: ClosetItemFitStatus;
  /** How many times this item has been anchored to a new outfit. */
  anchorToOutfitCount?: number;
  /** How many times this item has been matched to a recommendation. */
  matchedToRecommendationCount?: number;
};
