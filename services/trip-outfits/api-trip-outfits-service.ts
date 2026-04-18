import { createApiClient } from '@/lib/api/api-client';
import type {
  GenerateTripOutfitsParams,
  GenerateTripOutfitsResponse,
  TripDaySketchResponse,
  TripDaySketchStatusResponse,
  TripOutfitDay,
} from './trip-outfit-types';

type RawDay = Omit<TripOutfitDay, 'sketchStatus' | 'sketchUrl' | 'sketchJobId'>;

type RawResponse = {
  tripId: string;
  days: RawDay[];
};

export const tripOutfitsService = {
  async generateTripOutfits(params: GenerateTripOutfitsParams): Promise<GenerateTripOutfitsResponse> {
    const response = await createApiClient().request<RawResponse>('/trips/generate', {
      method: 'POST',
      body: params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to generate trip outfits.');
    }

    return {
      tripId: response.data.tripId,
      days: response.data.days.map((day) => ({
        ...day,
        sketchStatus: 'not_started' as const,
      })),
    };
  },

  async startDaySketch(params: {
    destination: string;
    dayTitle: string;
    climateLabel: string;
    pieces: string[];
    shoes: string;
    accessories: string[];
  }): Promise<TripDaySketchResponse> {
    const response = await createApiClient().request<TripDaySketchResponse>('/trips/sketch-day', {
      method: 'POST',
      body: params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to start sketch generation.');
    }

    return response.data;
  },

  async getDaySketchStatus(jobId: string): Promise<TripDaySketchStatusResponse> {
    const response = await createApiClient().request<TripDaySketchStatusResponse>(
      `/trips/sketch-day/${jobId}`
    );

    if (!response.success || !response.data) {
      return { sketchStatus: 'failed', sketchImageUrl: null };
    }

    return response.data;
  },
};
