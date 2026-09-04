import type { GenerateTripDayVariantsParams, TripOutfitDay } from '@/services/trip-outfits';

// Two-way handoff between a trip day card and the dedicated variant-selection
// screen: the request payload goes IN via setPendingRequest/consumePendingRequest
// (set right before navigating, read once on the new screen's mount — mirrors
// how camera-capture-result.ts hands data across a push/pop boundary), and the
// chosen variant comes back OUT via the same listener pattern camera-capture-result.ts
// uses for its single-result handoff.

type VariantResultListener = (day: TripOutfitDay) => void;

let _pendingRequest: GenerateTripDayVariantsParams | null = null;
let _listener: VariantResultListener | null = null;

export const tripDayVariantFlow = {
  setPendingRequest(request: GenerateTripDayVariantsParams) {
    _pendingRequest = request;
  },
  consumePendingRequest(): GenerateTripDayVariantsParams | null {
    const request = _pendingRequest;
    _pendingRequest = null;
    return request;
  },
  setListener(fn: VariantResultListener) {
    _listener = fn;
  },
  clearListener() {
    _listener = null;
  },
  emit(day: TripOutfitDay) {
    _listener?.(day);
    _listener = null;
  },
};
