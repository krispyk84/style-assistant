import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTripModeHref, buildTripResultsHref } from '@/lib/trip-route';
import type { SavedTripSummary } from '@/services/saved-trips';
import { TravelPlannerNewTripForm } from './TravelPlannerNewTripForm';
import { TravelPlannerSavedTab } from './TravelPlannerSavedTab';
import { useSavedTripsData } from './useSavedTripsData';
import { useTravelPlannerForm } from './useTravelPlannerForm';
import type { PlannerTab } from './travel-planner-types';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function TravelPlannerScreen() {
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<PlannerTab>('new');

  // Set to true when we navigate to trip-anchors; on re-focus we reset the form
  const navigatedToAnchorsRef = useRef(false);

  const savedTripsData = useSavedTripsData();
  const plannerForm = useTravelPlannerForm();
  const { resetForm, saveDraft } = plannerForm;
  const { loadSavedTrips } = savedTripsData;

  // Reload saved trips whenever this screen comes into focus; reset form if returning from anchors
  useFocusEffect(
    useCallback(() => {
      loadSavedTrips();
      if (navigatedToAnchorsRef.current) {
        navigatedToAnchorsRef.current = false;
        resetForm();
      }
    }, [loadSavedTrips, resetForm]),
  );

  function handleOpenSavedTrip(trip: SavedTripSummary) {
    router.push(buildTripResultsHref({
      tripId: trip.tripId,
      destination: trip.destination,
      savedTripId: trip.id,
    }));
  }

  async function handleSubmit() {
    const didSave = await saveDraft();
    if (!didSave) return;
    navigatedToAnchorsRef.current = true;
    router.push(buildTripModeHref());
  }

  return (
    <AppScreen scrollable backButton topInset>
      <View style={{ gap: spacing.xl }}>
        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Travel Planner</AppText>
          <AppText tone="muted">Pack smart for every trip.</AppText>
        </View>

        {/* Segmented control */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            padding: 3,
          }}>
          {(['new', 'saved'] as PlannerTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? theme.colors.text : 'transparent',
                  borderRadius: 11,
                  flex: 1,
                  paddingVertical: spacing.sm,
                }}>
                <AppText
                  style={{
                    color: isActive ? theme.colors.inverseText : theme.colors.mutedText,
                    fontFamily: staticTheme.fonts.sansMedium,
                    fontSize: 13,
                    letterSpacing: 0.4,
                  }}>
                  {tab === 'new' ? 'New Trip' : 'Saved Trips'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'saved' ? (
          <TravelPlannerSavedTab savedTripsData={savedTripsData} onOpenTrip={handleOpenSavedTrip} />
        ) : (
          <TravelPlannerNewTripForm form={plannerForm} onSubmit={() => void handleSubmit()} />
        )}
      </View>
    </AppScreen>
  );
}
