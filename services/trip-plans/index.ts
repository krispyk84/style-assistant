import { createApiClient } from '@/lib/api/api-client';
import type { TripAnchorInput } from '@/services/trip-outfits';

export type TripPlanDraft = {
  destination: string;
  country: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  travelParty: string;
  purposes: string[];
  climateLabel: string;
  styleVibe: string;
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;
  carryOnOnly: boolean;
  activities?: string;
  dressCode?: string;
  specialNeeds?: string;
  anchorMode?: 'guided' | 'auto' | 'manual';
};

export type TripAnchorRecord = TripAnchorInput & {
  slotId?: string;
  uploadedImageId?: string;
  imageUrl?: string;
  position?: number;
};

/** Fire-and-forget: save the trip draft on the server so it can be resumed later. */
export async function saveTripPlanDraft(draft: TripPlanDraft): Promise<string | null> {
  try {
    const res = await createApiClient().request<{ id: string }>('/trips/plan', {
      method: 'POST',
      body: draft,
    });
    return res.success && res.data ? res.data.id : null;
  } catch {
    return null;
  }
}

/** Save final anchor selections for a plan (called before generation). */
export async function saveTripPlanAnchors(
  planId: string,
  anchorMode: 'guided' | 'auto' | 'manual',
  anchors: TripAnchorRecord[],
): Promise<boolean> {
  try {
    const res = await createApiClient().request(`/trips/plan/${planId}/anchors`, {
      method: 'PATCH',
      body: { anchorMode, anchors },
    });
    return res.success;
  } catch {
    return false;
  }
}
