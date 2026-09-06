export type OutfitFrameworkSlotDto = {
  label: string;
  items: { title: string; closetItemId: string }[];
};

/** The enforced outfit framework's slot-by-slot breakdown, for display on the card. */
export type OutfitFrameworkDto = {
  frameworkLabel: string;
  slots: OutfitFrameworkSlotDto[];
};

export type TripOutfitDayDto = {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;           // YYYY-MM-DD
  title: string;          // e.g. "Arrival in Kyoto"
  dayType: string;        // travel_day | sightseeing | business | dinner_out | beach_pool | adventure | wedding_event | relaxed | conference
  /** Set only for "From My Closet" (fullCloset) days — the model's explicit per-day formality (may differ from dayType's default mapping when the user's notes override it). Pass this back on regenerate/variants/accessory-toggle requests for this day so it stays consistent. */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
  rationale: string;      // Why this outfit for this day
  pieces: string[];       // Main garment pieces (top, bottom, layer)
  shoes: string;          // Shoes description
  bag: string | null;
  accessories: string[];
  contextTags: string[];  // e.g. ["layered", "beach-ready", "wrinkle-resistant"]
  /** Set only for "From My Closet" (fullCloset) days — real closet item ids the pieces above resolve to. */
  closetItemIds?: string[];
  /** Set only for "From My Closet" (fullCloset) days — the enforced framework's slot breakdown. */
  framework?: OutfitFrameworkDto;
};

export type TripAnchorInputDto = {
  slotId?: string;
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  uploadedImageId?: string;
  imageUrl?: string;
  rationale?: string;
};

export type GenerateTripOutfitsRequest = {
  tripId: string;
  profileId?: string;
  anchors?: TripAnchorInputDto[];
  anchorMode?: 'guided' | 'auto' | 'manual' | 'fullCloset';
  destination: string;       // human-readable label
  country: string;
  departureDate: string;     // YYYY-MM-DD
  returnDate: string;        // YYYY-MM-DD
  travelParty: string;       // Solo | Couple | Family | Group
  purposes: string[];        // Business | Conference | Leisure | Wedding / Event | Beach / Resort | Adventure
  climateLabel: string;      // e.g. "Warm and dry, cooler evenings"
  avgHighC?: number;
  avgLowC?: number;
  tempBand?: string;         // hot | warm | mild | cool | cold
  precipChar?: string;       // dry | variable | wet
  packingTag?: string;       // hot_dry | warm_wet | mild_dry | cool | cold | etc.
  dressSeason?: string;      // summer | spring_autumn | winter | tropical
  activities?: string;       // free text
  dressCode?: string;        // free text
  styleVibe: string;         // Relaxed | Smart Cas | Polished | Mix
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;        // 1 | 2 | 3 | 4+
  jacketsCount?: string;     // 0 | 1 | 2 | 3
  /** Outerwear pieces already used on earlier days of this trip — threaded through so the cap is enforced across separate per-day requests. */
  usedOuterwear?: string[];
  /** Shoes already used on earlier days of this trip — same purpose as usedOuterwear, for the shoes cap. */
  usedFootwear?: string[];
  /** Closet-sourced "definitely bring" anchor item ids already featured on earlier days — fullCloset mode only. */
  usedAnchorItemIds?: string[];
  carryOnOnly: boolean;
  rewearOk?: boolean;
  specialNeeds?: string;
  /** Progressive generation: generate only this day (0-based index). */
  generateOnlyDayIndex?: number;
  /** Summaries of already-generated days to avoid piece repetition. */
  previousDaysSummary?: string[];
  /**
   * User-selected formality for the day at generateOnlyDayIndex (fullCloset
   * mode) — the trip form's per-day picker, defaulting to 'casual'. When
   * present, this is authoritative and overrides whatever the day-shape step
   * would otherwise infer from dayType, since it's a direct user choice, not
   * a suggestion for the model to weigh.
   */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
};

export type GenerateTripOutfitsResponse = {
  tripId: string;
  days: TripOutfitDayDto[];
};

export type RegenerateTripDayRequest = {
  tripId: string;
  dayIndex: number;
  date: string;
  dayType: string;
  /** The day's originally-decided formality (from its own TripOutfitDayDto.formalityTier) — when set, takes priority over the dayType→formality default so a regenerated day preserves the same formality intent (e.g. a user-overridden "smart casual" travel day). */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
  destination: string;
  country: string;
  climateLabel: string;
  avgHighC?: number;
  avgLowC?: number;
  activities?: string;
  dressCode?: string;
  styleVibe: string;
  purposes: string[];
  previousPieces: string[];
  previousShoes?: string;
  profileId?: string;
  isFullCloset?: boolean;
};

export type GenerateTripDayVariantsRequest = {
  tripId: string;
  dayIndex: number;
  date: string;
  dayType: string;
  /** The day's originally-decided formality — see RegenerateTripDayRequest's note. */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
  destination: string;
  country: string;
  climateLabel: string;
  avgHighC?: number;
  avgLowC?: number;
  activities?: string;
  dressCode?: string;
  styleVibe: string;
  purposes: string[];
  keepItemIds: string[];
  swapItemIds: string[];
  profileId?: string;
};

export type GenerateTripDayVariantsResponse = {
  variants: TripOutfitDayDto[];
};

/** Partial update: current full item list + desired hat/bag state for a single fullCloset day — mirrors closet's updateOutfitAccessories, scoped per day. */
export type UpdateTripDayAccessoriesRequest = {
  itemIds: string[];
  dayType: string;
  /** The day's originally-decided formality — see RegenerateTripDayRequest's note. */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
  includeHat: boolean;
  includeBag: boolean;
};

export type UpdateTripDayAccessoriesResponse = {
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  closetItemIds: string[];
};
