export type SavedTripDayDto = {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;
  title: string;
  dayType: string;
  rationale: string;
  pieces: string[];
  shoes: string;
  bag: string | null;
  accessories: string[];
  contextTags: string[];
  sketchStatus?: string;
  sketchUrl?: string;
  sketchJobId?: string;
  feedback?: 'love' | 'hate' | null;
};

export type SaveTripRequest = {
  tripId: string;
  destination: string;
  country: string;
  departureDate: string;
  returnDate: string;
  travelParty: string;
  climateLabel: string;
  styleVibe: string;
  purposes: string[];
  activities?: string;
  dressCode?: string;
  days: SavedTripDayDto[];
};

export type SavedTripSummaryDto = {
  id: string;
  tripId: string;
  destination: string;
  country: string;
  departureDate: string;
  returnDate: string;
  travelParty: string;
  climateLabel: string;
  styleVibe: string;
  purposes: string[];
  activities?: string;
  dressCode?: string;
  dayCount: number;
  savedAt: string;
  updatedAt: string;
};

export type SavedTripDetailDto = SavedTripSummaryDto & {
  days: SavedTripDayDto[];
};
