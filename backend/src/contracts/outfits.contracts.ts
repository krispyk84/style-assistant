export type OutfitTierSlug = 'business' | 'smart-casual' | 'casual';

export type GenerateOutfitsRequest = {
  requestId: string;
  profileId?: string;
  anchorItemDescription: string;
  anchorImageId?: string;
  anchorImageUrl?: string;
  photoPending: boolean;
  selectedTiers: OutfitTierSlug[];
};

export type TierRecommendationDto = {
  tier: OutfitTierSlug;
  title: string;
  anchorItem: string;
  keyPieces: string[];
  shoes: string[];
  accessories: string[];
  fitNotes: string[];
  whyItWorks: string;
  stylingDirection: string;
  detailNotes: string[];
  variantIndex: number;
};

export type OutfitResponse = {
  requestId: string;
  status: 'completed';
  provider: 'mock' | 'openai';
  generatedAt: string;
  input: {
    anchorItemDescription: string;
    anchorImageId: string | null;
    anchorImageUrl: string | null;
    photoPending: boolean;
    selectedTiers: OutfitTierSlug[];
  };
  recommendations: TierRecommendationDto[];
};

export type RegenerateTierRequest = {
  tier: OutfitTierSlug;
};

export type RegenerateTierResponse = OutfitResponse;
