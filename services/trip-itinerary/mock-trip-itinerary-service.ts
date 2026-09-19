import type { TripItineraryService } from './trip-itinerary-service';

export const mockTripItineraryService: TripItineraryService = {
  async extractItinerary({ departureDate }) {
    return {
      success: true,
      data: {
        days: [{ date: departureDate, summary: 'Mock itinerary day — extracted plan would appear here.' }],
        excludedCount: 0,
      },
      error: null,
    };
  },
};
