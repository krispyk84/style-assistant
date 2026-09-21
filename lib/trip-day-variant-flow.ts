import type { OutfitThumbnailItem } from '@/components/cards/OutfitItemThumbnailRow';
import type { GenerateTripDayVariantsParams, TripOutfitDay } from '@/services/trip-outfits';

// Two-way handoff between a trip day card and the dedicated variant-selection
// screen: the request payload goes IN via setPendingRequest/consumePendingRequest
// (set right before navigating, read once on the new screen's mount — mirrors
// how camera-capture-result.ts hands data across a push/pop boundary), and the
// chosen variant comes back OUT via the same listener pattern camera-capture-result.ts
// uses for its single-result handoff.

export type PendingVariantRequest = GenerateTripDayVariantsParams & {
  /** The real item(s) being swapped out — shown at the top of the variant screen so it's clear what's changing. Not sent to the backend (extra keys are dropped by Zod parsing). */
  swappedItems: OutfitThumbnailItem[];
};

// Listener may return a Promise — see trip-day-swap-flow.ts's matching
// comment: the caller awaits emit() before navigating back so persistDay's
// write actually lands before any return-trip reload can race it.
type VariantResultListener = (day: TripOutfitDay) => void | Promise<void>;

let _pendingRequest: PendingVariantRequest | null = null;
let _listener: VariantResultListener | null = null;

export const tripDayVariantFlow = {
  setPendingRequest(request: PendingVariantRequest) {
    _pendingRequest = request;
  },
  consumePendingRequest(): PendingVariantRequest | null {
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
  async emit(day: TripOutfitDay): Promise<void> {
    await _listener?.(day);
    _listener = null;
  },
};
