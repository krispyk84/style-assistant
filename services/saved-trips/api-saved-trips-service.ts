import { createApiClient, unwrapOrThrow } from '@/lib/api/api-client';
import type { SavedTripDetail, SavedTripSummary, SaveTripParams } from './saved-trip-types';
import type { TripOutfitDay } from '@/services/trip-outfits';

// The API stores days as plain JSON — sketch client fields need defaults restored.
function normalizeDays(raw: unknown[]): TripOutfitDay[] {
  return raw.map((d) => {
    const day = d as Record<string, unknown>;
    return {
      ...(day as TripOutfitDay),
      sketchStatus: (day.sketchStatus as TripOutfitDay['sketchStatus']) ?? 'not_started',
      feedback: (day.feedback as TripOutfitDay['feedback']) ?? null,
    };
  });
}

export const savedTripsService = {
  async save(params: SaveTripParams): Promise<SavedTripDetail> {
    const response = await createApiClient().request<SavedTripDetail>('/trips/saved', {
      method: 'POST',
      body: params,
    });
    const data = unwrapOrThrow(response, 'Failed to save trip.');
    return {
      ...data,
      days: normalizeDays(data.days as unknown[]),
    };
  },

  async list(): Promise<SavedTripSummary[]> {
    const response = await createApiClient().request<{ trips: SavedTripSummary[] }>('/trips/saved', {
      method: 'GET',
    });
    return unwrapOrThrow(response, 'Failed to load saved trips.').trips;
  },

  async getById(id: string): Promise<SavedTripDetail> {
    const response = await createApiClient().request<SavedTripDetail>(`/trips/saved/${id}`, {
      method: 'GET',
    });
    const data = unwrapOrThrow(response, 'Failed to load saved trip.');
    return {
      ...data,
      days: normalizeDays(data.days as unknown[]),
    };
  },

  async delete(id: string): Promise<void> {
    const response = await createApiClient().request<null>(`/trips/saved/${id}`, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error(response.error?.message ?? 'Failed to delete saved trip.');
    }
  },
};
