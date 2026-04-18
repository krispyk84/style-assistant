import { createApiClient } from '@/lib/api/api-client';
import type {
  GenerateTripOutfitsParams,
  GenerateTripOutfitsResponse,
  RegenerateTripDayParams,
  RegenerateTripDayResponse,
  TripDaySketchResponse,
  TripDaySketchStatusResponse,
  TripOutfitDay,
} from './trip-outfit-types';

type RawDay = Omit<TripOutfitDay, 'sketchStatus' | 'sketchUrl' | 'sketchJobId' | 'feedback'>;

type RawGenerateResponse = {
  tripId: string;
  days: RawDay[];
};

export const tripOutfitsService = {
  async generateTripOutfits(params: GenerateTripOutfitsParams): Promise<GenerateTripOutfitsResponse> {
    const response = await createApiClient().request<RawGenerateResponse>('/trips/generate', {
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
        feedback: null,
      })),
    };
  },

  async regenerateDay(params: RegenerateTripDayParams): Promise<TripOutfitDay> {
    const response = await createApiClient().request<RegenerateTripDayResponse>('/trips/regenerate-day', {
      method: 'POST',
      body: params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to regenerate day outfit.');
    }

    return {
      ...response.data.day,
      sketchStatus: 'not_started' as const,
      feedback: null,
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
      const msg = response.error?.message ?? 'Failed to start sketch generation.';
      console.warn('[TripSketch] startDaySketch failed:', msg, response.error);
      throw new Error(msg);
    }

    return response.data;
  },

  async getDaySketchStatus(jobId: string): Promise<TripDaySketchStatusResponse> {
    const response = await createApiClient().request<TripDaySketchStatusResponse>(
      `/trips/sketch-day/${jobId}`
    );

    if (!response.success || !response.data) {
      console.warn('[TripSketch] getDaySketchStatus failed for jobId:', jobId, response.error);
      return { sketchStatus: 'failed', sketchImageUrl: null };
    }

    return response.data;
  },
};
