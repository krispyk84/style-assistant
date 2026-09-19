import type { LookRecommendation, LookTierSlug } from '@/types/look-request';

// One-way handoff for "Swap outfit" on a trip day: the LAUNCH side (which
// day, which formality, which closet-only default) travels as ordinary route
// params into /create-look or /stylist-outfit — this codebase already has
// that exact precedent (create-look.tsx's closetItemId/closetOnly params).
// Only the RETURN trip needs a dedicated mechanism, since a chosen
// LookRecommendation is too rich to serialize through route params and
// there's no returnTo/origin route convention anywhere in this app (grepped
// repo-wide). Mirrors camera-capture-result.ts's single-listener pub/sub —
// the same pattern lib/trip-day-variant-flow.ts already uses for its own
// "sub-screen hands a chosen day back" handoff.

type SwapResultListener = (recommendation: LookRecommendation, tier: LookTierSlug) => void;

let _listener: SwapResultListener | null = null;

export const tripDaySwapFlow = {
  setListener(fn: SwapResultListener) {
    _listener = fn;
  },
  clearListener() {
    _listener = null;
  },
  emit(recommendation: LookRecommendation, tier: LookTierSlug) {
    _listener?.(recommendation, tier);
    _listener = null;
  },
};
