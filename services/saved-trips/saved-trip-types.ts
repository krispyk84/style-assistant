import type { TripOutfitDay } from '@/services/trip-outfits';

export type SavedTripSummary = {
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

export type SavedTripDetail = SavedTripSummary & {
  days: TripOutfitDay[];
};

export type SaveTripParams = {
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
  days: TripOutfitDay[];
};
