export type TripAnchorMode = 'guided' | 'auto' | 'manual';

export type TripResultsRouteParams = {
  tripId: string;
  destination?: string;
  savedTripId?: string;
  isProgressiveGeneration?: boolean;
};

export function createTripId(now = Date.now()): string {
  return `trip-${now}`;
}

export function parseTripAnchorMode(mode?: string | string[] | null): TripAnchorMode {
  const value = Array.isArray(mode) ? mode[0] : mode;
  if (value === 'auto' || value === 'manual') return value;
  return 'guided';
}

export function buildTripModeHref() {
  return { pathname: '/trip-mode' as const };
}

export function buildTripAnchorsHref(mode: TripAnchorMode) {
  return {
    pathname: '/trip-anchors' as const,
    params: { mode },
  };
}

export function buildTripResultsHref({
  tripId,
  destination,
  savedTripId,
  isProgressiveGeneration = false,
}: TripResultsRouteParams) {
  return {
    pathname: '/trip-results' as const,
    params: {
      tripId,
      ...(destination ? { destination } : {}),
      ...(savedTripId ? { savedTripId } : {}),
      ...(isProgressiveGeneration ? { isProgressiveGeneration: '1' } : {}),
    },
  };
}

export function buildPackingListHref({
  tripId,
  savedTripId,
}: {
  tripId: string;
  savedTripId?: string;
}) {
  return {
    pathname: '/packing-list' as const,
    params: {
      tripId,
      ...(savedTripId ? { savedTripId } : {}),
    },
  };
}
