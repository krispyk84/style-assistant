import type { TripDraft } from '@/lib/trip-draft-storage';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import type { SavedTripDetail } from '@/services/saved-trips';
import type { GenerateTripOutfitsParams, TripOutfitDay } from '@/services/trip-outfits';

export function buildStoredTripPlanFromDraft(tripId: string, draft: TripDraft): StoredTripPlan {
  return {
    tripId,
    destination: draft.destinationLabel,
    country: draft.country,
    departureDate: draft.departureDate,
    returnDate: draft.returnDate,
    travelParty: draft.travelParty,
    climateLabel: draft.climateLabel,
    avgHighC: draft.avgHighC,
    avgLowC: draft.avgLowC,
    styleVibe: draft.styleVibe,
    purposes: draft.purposes,
    activities: draft.activities,
    dressCode: draft.dressCode,
    days: [],
    generatedAt: new Date().toISOString(),
  };
}

export function buildStoredTripPlanFromSavedTrip(detail: SavedTripDetail): StoredTripPlan {
  return {
    tripId: detail.tripId,
    destination: detail.destination,
    country: detail.country,
    departureDate: detail.departureDate,
    returnDate: detail.returnDate,
    travelParty: detail.travelParty,
    climateLabel: detail.climateLabel,
    styleVibe: detail.styleVibe,
    purposes: detail.purposes,
    activities: detail.activities,
    dressCode: detail.dressCode,
    days: detail.days,
    generatedAt: detail.savedAt,
  };
}

export function buildPreviousTripDaysSummary(days: TripOutfitDay[]): string[] {
  return days.map((day) =>
    `Day ${day.dayIndex + 1} (${day.date}, ${day.dayType}): ${day.pieces.join(', ')}${day.shoes ? `, ${day.shoes}` : ''}`
  );
}

export function buildTripDayGenerationParams({
  tripId,
  draft,
  dayIndex,
  previousDaysSummary,
}: {
  tripId: string;
  draft: TripDraft;
  dayIndex: number;
  previousDaysSummary: string[];
}): GenerateTripOutfitsParams {
  return {
    tripId,
    destination: draft.destinationLabel,
    country: draft.country,
    departureDate: draft.departureDate,
    returnDate: draft.returnDate,
    travelParty: draft.travelParty,
    purposes: draft.purposes,
    climateLabel: draft.climateLabel,
    avgHighC: draft.avgHighC,
    avgLowC: draft.avgLowC,
    tempBand: draft.tempBand,
    precipChar: draft.precipChar,
    packingTag: draft.packingTag,
    dressSeason: draft.dressSeason,
    activities: draft.activities,
    dressCode: draft.dressCode,
    styleVibe: draft.styleVibe,
    willSwim: draft.willSwim,
    fancyNights: draft.fancyNights,
    workoutClothes: draft.workoutClothes,
    laundryAccess: draft.laundryAccess,
    shoesCount: draft.shoesCount,
    carryOnOnly: draft.carryOnOnly,
    specialNeeds: draft.specialNeeds,
    anchors: draft.pendingAnchors,
    anchorMode: draft.pendingAnchorMode,
    generateOnlyDayIndex: dayIndex,
    previousDaysSummary,
  };
}
