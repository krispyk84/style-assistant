import type { OutfitFrameworkDisplay } from '@/types/api';

export type TripDayType =
  | 'travel_day'
  | 'sightseeing'
  | 'business'
  | 'meeting'
  | 'dinner_out'
  | 'beach_pool'
  | 'adventure'
  | 'wedding_event'
  | 'relaxed'
  | 'conference';

export type TripOutfitDay = {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;           // YYYY-MM-DD
  title: string;
  dayType: TripDayType;
  /** Set only for "From My Closet" (fullCloset) days — the model's (or user's) explicit per-day formality. Pass this back on regenerate/variants/accessory-toggle requests for this day so it stays consistent. */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
  rationale: string;
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  contextTags: string[];
  /** Set only for "From My Closet" (fullCloset) days — real closet item ids the pieces above resolve to. */
  closetItemIds?: string[];
  /** Set only for "From My Closet" (fullCloset) days — the enforced framework's slot breakdown. */
  framework?: OutfitFrameworkDisplay;
  sketchStatus: 'not_started' | 'loading' | 'ready' | 'failed';
  sketchUrl?: string;
  sketchJobId?: string;
  feedback?: 'love' | 'hate' | null;
};

export type RegenerateTripDayParams = {
  tripId: string;
  dayIndex: number;
  date: string;
  dayType: TripDayType;
  /** The day's originally-decided formality (from its own TripOutfitDay.formalityTier) — pass this through so regeneration preserves it. */
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
  isFullCloset?: boolean;
};

export type GenerateTripDayVariantsParams = {
  tripId: string;
  dayIndex: number;
  date: string;
  dayType: TripDayType;
  /** The day's originally-decided formality — see RegenerateTripDayParams' note. */
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
};

export type GenerateTripDayVariantsResponse = {
  variants: TripOutfitDay[];
};

export type TripAnchorInput = {
  slotId?: string;
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  uploadedImageId?: string;
  imageUrl?: string;
  rationale?: string;
};

export type GenerateTripOutfitsParams = {
  tripId: string;
  /** Anchor pieces to build outfits around (optional). */
  anchors?: TripAnchorInput[];
  anchorMode?: 'guided' | 'auto' | 'manual' | 'fullCloset';
  destination: string;
  country: string;
  departureDate: string;   // YYYY-MM-DD
  returnDate: string;      // YYYY-MM-DD
  travelParty: string;
  purposes: string[];
  climateLabel: string;
  avgHighC?: number;
  avgLowC?: number;
  tempBand?: string;
  precipChar?: string;
  packingTag?: string;
  dressSeason?: string;
  activities?: string;
  dressCode?: string;
  styleVibe: string;
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;
  jacketsCount?: string;
  /** Outerwear pieces already used on earlier days of this trip — threaded through so the cap holds across separate per-day requests. */
  usedOuterwear?: string[];
  /** Shoes already used on earlier days of this trip — same purpose as usedOuterwear, for the shoes cap. */
  usedFootwear?: string[];
  /** Closet-sourced "definitely bring" anchor item ids already featured on earlier days — fullCloset mode only, threaded so each anchor gets pinned into a day once rather than reconsidered (or ignored) every request. */
  usedAnchorItemIds?: string[];
  carryOnOnly: boolean;
  rewearOk?: boolean;
  specialNeeds?: string;
  generateOnlyDayIndex?: number;
  previousDaysSummary?: string[];
  /** User-selected formality for the day at generateOnlyDayIndex (trip form's per-day picker, defaults to 'casual') — authoritative when set. */
  formalityTier?: 'casual' | 'smart-casual' | 'business';
};

export type GenerateTripOutfitsResponse = {
  tripId: string;
  days: TripOutfitDay[];
};

export type TripDaySketchResponse = {
  jobId: string;
};

export type TripDaySketchStatusResponse = {
  sketchStatus: 'pending' | 'ready' | 'failed';
  sketchImageUrl: string | null;
};

export type RegenerateTripDayResponse = {
  day: Omit<TripOutfitDay, 'sketchStatus' | 'sketchUrl' | 'sketchJobId' | 'feedback'>;
};

/** Partial update: current full item list + desired hat/bag state for a single fullCloset day — every other already-chosen item, plus title/rationale, is left untouched. */
export type UpdateTripDayAccessoriesParams = {
  itemIds: string[];
  dayType: TripDayType;
  /** The day's originally-decided formality — see RegenerateTripDayParams' note. */
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
  framework?: OutfitFrameworkDisplay;
};
