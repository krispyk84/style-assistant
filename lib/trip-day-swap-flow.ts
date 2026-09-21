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

// Listener may return a Promise — the caller (e.g. MultiLookResults'
// "Use for [Day]" handler) awaits emit() before navigating back, so the
// day's persistDay write actually lands before trip-results' return-trip
// reload effect re-fetches. Without this, emit()+navigate raced against
// persistDay's un-awaited network write: whichever landed first won, so the
// reload could show pre-swap data — not just for the swapped day, but
// (since the reload replaces the whole day list) intermittently for every
// other already-ready day too, right down to kicking off a fresh sketch
// generation for them.
type SwapResultListener = (recommendation: LookRecommendation, tier: LookTierSlug) => void | Promise<void>;

let _listener: SwapResultListener | null = null;

export const tripDaySwapFlow = {
  setListener(fn: SwapResultListener) {
    _listener = fn;
  },
  clearListener() {
    _listener = null;
  },
  async emit(recommendation: LookRecommendation, tier: LookTierSlug): Promise<void> {
    await _listener?.(recommendation, tier);
    _listener = null;
  },
};
