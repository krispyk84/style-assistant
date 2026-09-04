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
  /** When set, OpenAI generates only this one tier while selectedTiers is stored as the full set. */
  generateOnlyTier?: OutfitTierSlug;
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
  /** Season explicitly selected by the user. When present, overrides weather-driven styling in the prompt. */
  manualSeason?: 'winter' | 'spring' | 'summer' | 'fall' | null;
  /** User opted to have an outfit-appropriate bag included in the generated look. */
  includeBag?: boolean;
  /** User opted to have an outfit-appropriate hat included in the generated look. */
  includeHat?: boolean;
  /** Freeform additional guidance to steer the outfit. */
  additionalDetails?: string;
  /** When set, every recommendation is built entirely from the user's real closet items — mirrors trips' fullCloset mode. */
  closetOnly?: boolean;
  /** Variation context — set when generating multiple looks of the same tier from the same anchors. */
  variantContext?: {
    /** 1-based index of this variation within the batch. */
    index: number;
    /** Total number of variations in the batch (2 or 3). */
    total: number;
    /** Summaries of variations already generated (to enforce meaningful distinctness). */
    previousVariations?: Array<{
      title: string;
      stylingDirection: string;
      keyPieces: string[];
      shoes: string[];
      accessories: string[];
    }>;
  };
  /** Location-derived, for seasonal fashion trend lookup — separate from weatherContext since it isn't weather data. */
  hemisphere?: 'northern' | 'southern';
  region?: string;
  /**
   * Outfit trendiness 0–100 (lower = safer/classic, higher = trendier).
   * Sourced from the user's app settings on the device.
   */
  trendiness?: number;
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
  /** Set only when the request was closetOnly — real closet item ids this recommendation's pieces resolve to. */
  closetItemIds?: string[];
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
    manualSeason?: GenerateOutfitsRequest['manualSeason'];
    hemisphere?: GenerateOutfitsRequest['hemisphere'];
    region?: GenerateOutfitsRequest['region'];
    includeBag?: boolean;
    includeHat?: boolean;
    closetOnly?: boolean;
    additionalDetails?: string;
    trendiness?: number;
  };
  recommendations: TierRecommendationDto[];
};

export type RegenerateTierRequest = {
  tier: OutfitTierSlug;
};

export type RegenerateTierResponse = OutfitResponse;
