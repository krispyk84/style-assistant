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
  rationale: string;
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  contextTags: string[];
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
};

export type TripAnchorInput = {
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  rationale?: string;
};

export type GenerateTripOutfitsParams = {
  tripId: string;
  /** Anchor pieces to build outfits around (optional). */
  anchors?: TripAnchorInput[];
  anchorMode?: 'guided' | 'auto' | 'manual';
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
  carryOnOnly: boolean;
  specialNeeds?: string;
  generateOnlyDayIndex?: number;
  previousDaysSummary?: string[];
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
