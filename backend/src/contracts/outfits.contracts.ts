export type OutfitTierSlug = 'business' | 'smart-casual' | 'casual';
export type TierSketchStatus = 'pending' | 'ready' | 'failed';

export type OutfitPieceMeta = {
  category: string;
  color: string;
  material?: string | null;
  formality: 'Casual' | 'Smart Casual' | 'Refined Casual' | 'Formal';
};

/** Structured outfit piece. Legacy stored records may have null metadata. */
export type OutfitPieceDto = {
  display_name: string;
  metadata: OutfitPieceMeta | null;
};

export type GenerateOutfitsRequest = {
  requestId: string;
  profileId?: string;
  anchorItems?: Array<{
    description: string;
    imageId?: string;
    imageUrl?: string;
  }>;
  anchorItemDescription: string;
  vibeKeywords?: string;
  anchorImageId?: string;
  anchorImageUrl?: string;
  photoPending: boolean;
  selectedTiers: OutfitTierSlug[];
  weatherContext?: {
    temperatureC: number;
    apparentTemperatureC: number;
    weatherCode: number;
    season: 'winter' | 'spring' | 'summer' | 'fall';
    summary: string;
    stylingHint: string;
    locationLabel: string | null;
    fetchedAt: string;
  } | null;
};

export type TierRecommendationDto = {
  tier: OutfitTierSlug;
  title: string;
  anchorItem: string;
  keyPieces: OutfitPieceDto[];
  shoes: OutfitPieceDto[];
  accessories: OutfitPieceDto[];
  fitNotes: string[];
  whyItWorks: string;
  stylingDirection: string;
  detailNotes: string[];
  sketchStatus: TierSketchStatus;
  sketchImageUrl: string | null;
  sketchStorageKey: string | null;
  sketchMimeType: string | null;
  sketchImageData?: Buffer | null;
  variantIndex: number;
};

export type OutfitResponse = {
  requestId: string;
  status: 'completed';
  provider: 'mock' | 'openai';
  generatedAt: string;
  input: {
    anchorItems?: GenerateOutfitsRequest['anchorItems'];
    anchorItemDescription: string;
    vibeKeywords?: string;
    anchorImageId: string | null;
    anchorImageUrl: string | null;
    photoPending: boolean;
    selectedTiers: OutfitTierSlug[];
    weatherContext?: GenerateOutfitsRequest['weatherContext'];
  };
  recommendations: TierRecommendationDto[];
};

export type RegenerateTierRequest = {
  tier: OutfitTierSlug;
};

export type RegenerateTierResponse = OutfitResponse;
