import { useCallback } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing } from '@/constants/theme';
import { buildTravelPlannerNewTripHref, buildTripResultsHref } from '@/lib/trip-route';
import type { SavedTripSummary } from '@/services/saved-trips';
import { TravelPlannerSavedTab } from './TravelPlannerSavedTab';
import { useSavedTripsData } from './useSavedTripsData';

// ── Screen ─────────────────────────────────────────────────────────────────────
// Trip hub: saved/upcoming trips as cards + a prominent "+ New Trip" CTA,
// replacing the old New Trip/Saved Trips segmented control (which made the
// trip list feel like just another state of the creation form). New Trip now
// pushes into its own dedicated wizard screen (TravelPlannerNewTripScreen),
// which always mounts fresh (its own useTravelPlannerForm instance), so there
// is no stale in-progress state to reset here.

export function TravelPlannerScreen() {
  const savedTripsData = useSavedTripsData();
  const { loadSavedTrips } = savedTripsData;

  useFocusEffect(
    useCallback(() => {
      loadSavedTrips();
    }, [loadSavedTrips]),
  );

  function handleOpenSavedTrip(trip: SavedTripSummary) {
    router.push(buildTripResultsHref({
      tripId: trip.tripId,
      destination: trip.destination,
      savedTripId: trip.id,
    }));
  }

  function handleNewTrip() {
    router.push(buildTravelPlannerNewTripHref());
  }

  return (
    <AppScreen scrollable topInset>
      <View style={{ gap: spacing.xl }}>
        <AppText variant="heroSmall">Travel Planner</AppText>

        <PrimaryButton label="+ New Trip" onPress={handleNewTrip} />

        <TravelPlannerSavedTab savedTripsData={savedTripsData} onOpenTrip={handleOpenSavedTrip} />
      </View>
    </AppScreen>
  );
}
