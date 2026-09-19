import type { ApiResponse } from '@/types/api';

export type ItineraryPdfAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export type ExtractItineraryInput = {
  file: ItineraryPdfAsset;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string;    // YYYY-MM-DD
};

export type ExtractedItineraryDay = { date: string; summary: string };

export type ExtractItineraryResponse = {
  days: ExtractedItineraryDay[];
  /** Entries the extraction found but that fell outside this trip's own dates/destination — surfaced so the UI can tell the user something was skipped. */
  excludedCount: number;
};

export type TripItineraryService = {
  extractItinerary: (input: ExtractItineraryInput) => Promise<ApiResponse<ExtractItineraryResponse>>;
};
