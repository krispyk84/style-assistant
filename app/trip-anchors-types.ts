import type { ScoredAnchorCandidate } from '@/lib/trip-anchor-recommender';

export type AnchorMode = 'guided' | 'auto' | 'manual';

export type SelectedAnchor = {
  id: string;
  slotId?: string;
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  closetItemTitle?: string;
  closetItemImageUrl?: string;
  localImageUri?: string;
  uploadedImageId?: string;
  imageUrl?: string;
  rationale?: string;
  /** What the slot is looking for (displayed above the item name in auto mode). */
  slotLabel?: string;
  slotRationale?: string;
  /** Scored alternates for "Try something else" (auto mode). */
  alternates?: ScoredAnchorCandidate[];
  /** Index of the alternate currently shown (-1 = showing best candidate). */
  alternateIndex?: number;
};
