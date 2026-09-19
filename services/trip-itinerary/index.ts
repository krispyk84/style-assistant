import { canUseRealApi } from '@/lib/api/api-client';
import { apiTripItineraryService } from '@/services/trip-itinerary/api-trip-itinerary-service';
import { mockTripItineraryService } from '@/services/trip-itinerary/mock-trip-itinerary-service';

export const tripItineraryService = canUseRealApi() ? apiTripItineraryService : mockTripItineraryService;
export type { ExtractedItineraryDay, ExtractItineraryInput, ExtractItineraryResponse, ItineraryPdfAsset } from './trip-itinerary-service';
