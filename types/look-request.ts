import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';

export const LOOK_TIER_OPTIONS = ['business', 'smart-casual', 'casual'] as const;

export type LookTierSlug = (typeof LOOK_TIER_OPTIONS)[number];

export type CreateLookInput = {
  anchorItemDescription: string;
  anchorImage: LocalImageAsset | null;
  uploadedAnchorImage: UploadedImageAsset | null;
  photoPending: boolean;
  selectedTiers: LookTierSlug[];
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
  keyPieces: string[];
  shoes: string[];
  accessories: string[];
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
