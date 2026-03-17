import type { CreateLookInput, LookRecommendation } from '@/types/look-request';

export type OutfitTierKey = 'essential' | 'refined' | 'editorial';

export type AnchorItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  occasion: string;
  description: string;
};

export type OutfitPiece = {
  name: string;
  note: string;
};

export type OutfitResult = {
  requestId: string;
  title: string;
  headline: string;
  summary: string;
  occasion: string;
  tier: OutfitTierKey;
  tierLabel: string;
  confidence: string;
  stylistNote: string;
  pieces: OutfitPiece[];
};

export type OutfitTier = {
  key: OutfitTierKey;
  name: string;
  priceBand: string;
  description: string;
  benefits: string[];
  bestFor: string;
};

export type SavedOutfit = {
  id: string;
  requestId: string;
  savedAt: string;
  input: CreateLookInput;
  recommendation: LookRecommendation;
};
