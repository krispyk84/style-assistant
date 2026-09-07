import type { TripDraft } from '@/lib/trip-draft-storage';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import { categorizeTripItem } from '@/lib/outfit-piece-display';
import type { SavedTripDetail, SaveTripParams } from '@/services/saved-trips';
import type { GenerateTripOutfitsParams, TripOutfitDay } from '@/services/trip-outfits';

export type TripGenerationResumePoint = {
  /** How many days this trip should generate in total (capped at 8). */
  totalDays: number;
  /** The first day index still needing generation — 0 for a fresh trip. */
  startIndex: number;
  /** True when every day is already generated — nothing left to do. */
  isAlreadyComplete: boolean;
};

/**
 * Pure resume-vs-restart decision for useTripResultsData's progressive
 * generation loop, extracted so it's testable without rendering the hook.
 * A remount (e.g. back-then-forward navigation) re-runs the effect that
 * calls this — resuming from existingDays.length instead of always
 * restarting at 0 is what stops already-generated (and already-billed)
 * days from being silently regenerated.
 */
export function computeTripGenerationResumePoint(params: {
  numDays: number;
  existingDays: TripOutfitDay[] | undefined;
}): TripGenerationResumePoint {
  const totalDays = Math.min(8, params.numDays);
  const startIndex = params.existingDays?.length ?? 0;
  return {
    totalDays,
    startIndex,
    isAlreadyComplete: params.existingDays !== undefined && startIndex >= totalDays,
  };
}

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

// The saved-trips POST endpoint upserts on (userId, tripId), so re-posting
// with the same plan.tripId and a freshly-edited days array is how any
// mutation on an already-saved trip (love/hate, sketch, variant swap, hat/
// bag toggle, remove-from-outfit) gets persisted past the current screen
// session — without this, those edits only ever lived in local React state
// and reverted to the last-saved version the moment you navigated away.
export function buildSaveTripPayload(plan: StoredTripPlan, days: TripOutfitDay[]): SaveTripParams {
  return {
    tripId: plan.tripId,
    destination: plan.destination,
    country: plan.country,
    departureDate: plan.departureDate ?? '',
    returnDate: plan.returnDate ?? '',
    travelParty: plan.travelParty ?? 'Solo',
    climateLabel: plan.climateLabel,
    styleVibe: plan.styleVibe,
    purposes: plan.purposes,
    activities: plan.activities,
    dressCode: plan.dressCode,
    days: days.map((day) => (day.sketchStatus === 'loading' ? { ...day, sketchStatus: 'not_started' as const } : day)),
  };
}

export function buildPreviousTripDaysSummary(days: TripOutfitDay[]): string[] {
  return days.map((day) =>
    `Day ${day.dayIndex + 1} (${day.date}, ${day.dayType}): ${day.pieces.join(', ')}${day.shoes ? `, ${day.shoes}` : ''}`
  );
}

/** Distinct outerwear pieces (jacket/coat/blazer/etc.) already used on earlier days — threaded into each subsequent generation request so the outerwear cap holds across the whole trip, not just within one day. */
export function collectUsedOuterwear(days: TripOutfitDay[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const day of days) {
    for (const piece of day.pieces ?? []) {
      if (categorizeTripItem(piece) !== 'Outerwear') continue;
      const key = piece.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(piece);
    }
  }
  return result;
}

/** Closet-sourced "definitely bring" anchor item ids already used on earlier days — threaded so a fullCloset trip actually features them across the trip instead of only ever considering them (or ignoring them) on day one. */
export function collectUsedAnchorItemIds(days: TripOutfitDay[]): string[] {
  const seen = new Set<string>();
  for (const day of days) {
    for (const id of day.closetItemIds ?? []) seen.add(id);
  }
  return [...seen];
}

/** Distinct shoes already used on earlier days — same purpose as collectUsedOuterwear, for the shoes cap. */
export function collectUsedFootwear(days: TripOutfitDay[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const day of days) {
    if (!day.shoes) continue;
    const key = day.shoes.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(day.shoes);
  }
  return result;
}

export function buildTripDayGenerationParams({
  tripId,
  draft,
  dayIndex,
  previousDaysSummary,
  usedOuterwear,
  usedFootwear,
  usedAnchorItemIds,
}: {
  tripId: string;
  draft: TripDraft;
  dayIndex: number;
  previousDaysSummary: string[];
  usedOuterwear: string[];
  usedFootwear: string[];
  usedAnchorItemIds: string[];
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
    jacketsCount: draft.jacketsCount,
    carryOnOnly: draft.carryOnOnly,
    rewearOk: draft.rewearOk,
    specialNeeds: draft.specialNeeds,
    anchors: draft.pendingAnchors,
    anchorMode: draft.pendingAnchorMode,
    generateOnlyDayIndex: dayIndex,
    previousDaysSummary,
    usedOuterwear,
    usedFootwear,
    usedAnchorItemIds,
    formalityTier: draft.dayFormality?.[dayIndex] ?? 'casual',
  };
}
