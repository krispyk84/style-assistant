import type { TripDraft } from '@/lib/trip-draft-storage';
import type { DestinationResult } from '@/services/destination';
import type { TravelClimateProfile } from '@/services/travel-climate';
import type {
  ShoeCount,
  StyleVibe,
  TravelParty,
  TripPurpose,
  YesNo,
  YesNoUnsure,
} from './travel-planner-types';

export function toTripISODate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function calculateTripDays(departureDate: Date | null, returnDate: Date | null): number {
  if (!departureDate || !returnDate) return 0;
  const dep = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate());
  const ret = new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate());
  return Math.round((ret.getTime() - dep.getTime()) / 86_400_000) + 1;
}

export function splitTripsByDate<T extends { departureDate: string }>(trips: T[]) {
  const today = new Date().toISOString().split('T')[0]!;
  return {
    upcoming: trips
      .filter((trip) => trip.departureDate >= today)
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate)),
    past: trips
      .filter((trip) => trip.departureDate < today)
      .sort((a, b) => b.departureDate.localeCompare(a.departureDate)),
  };
}

type BuildTripDraftParams = {
  destination: DestinationResult;
  departureDate: Date;
  returnDate: Date;
  numDays: number;
  travelParty: TravelParty;
  purposes: TripPurpose[];
  climate: string;
  climateProfile: TravelClimateProfile | null;
  activities: string;
  dressCode: string;
  styleVibe: StyleVibe;
  willSwim: YesNo;
  fancyNights: YesNo;
  workoutClothes: YesNo;
  laundryAccess: YesNoUnsure;
  shoesCount: ShoeCount;
  carryOnOnly: YesNo;
  specialNeeds: string;
};

export function buildTripDraft({
  destination,
  departureDate,
  returnDate,
  numDays,
  travelParty,
  purposes,
  climate,
  climateProfile,
  activities,
  dressCode,
  styleVibe,
  willSwim,
  fancyNights,
  workoutClothes,
  laundryAccess,
  shoesCount,
  carryOnOnly,
  specialNeeds,
}: BuildTripDraftParams): TripDraft {
  return {
    draftId: `draft-${Date.now()}`,
    destinationLabel: destination.label,
    country: destination.country,
    lat: destination.lat,
    lng: destination.lng,
    geonameId: destination.geonameId,
    departureDate: toTripISODate(departureDate),
    returnDate: toTripISODate(returnDate),
    numDays,
    travelParty,
    purposes,
    climateLabel: climate || 'Not specified',
    avgHighC: climateProfile?.avgHighC,
    avgLowC: climateProfile?.avgLowC,
    tempBand: climateProfile?.tempBand,
    precipChar: climateProfile?.precipChar,
    packingTag: climateProfile?.packingTag,
    dressSeason: climateProfile?.dressSeason,
    activities: activities.trim() || undefined,
    dressCode: dressCode.trim() || undefined,
    styleVibe,
    willSwim: willSwim === 'Yes',
    fancyNights: fancyNights === 'Yes',
    workoutClothes: workoutClothes === 'Yes',
    laundryAccess,
    shoesCount,
    carryOnOnly: carryOnOnly === 'Yes',
    specialNeeds: specialNeeds.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}
