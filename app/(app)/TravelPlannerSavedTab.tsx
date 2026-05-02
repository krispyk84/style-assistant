import { ActivityIndicator, Pressable, View } from 'react-native';

import { SavedTripCard } from '@/components/cards/saved-trip-card';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { SavedTripSummary } from '@/services/saved-trips';
import type { useSavedTripsData } from './useSavedTripsData';

// ── Props ─────────────────────────────────────────────────────────────────────

type TravelPlannerSavedTabProps = {
  savedTripsData: ReturnType<typeof useSavedTripsData>;
  onOpenTrip: (trip: SavedTripSummary) => void;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function TravelPlannerSavedTab({ savedTripsData, onOpenTrip }: TravelPlannerSavedTabProps) {
  const { theme } = useTheme();
  const {
    savedTrips,
    savedTripsLoading,
    savedTripsError,
    pastExpanded,
    setPastExpanded,
    upcomingTrips,
    pastTrips,
    deleteSavedTrip,
  } = savedTripsData;

  if (savedTripsLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <ActivityIndicator color={theme.colors.mutedText} />
      </View>
    );
  }

  if (savedTripsError) {
    return (
      <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
        {savedTripsError}
      </AppText>
    );
  }

  if (savedTrips.length === 0) {
    return (
      <EmptyState
        title="No saved trips"
        message="Generate a trip plan and tap the bookmark to save it here."
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* Past trips toggle */}
      {pastTrips.length > 0 && (
        <Pressable
          onPress={() => setPastExpanded((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.xs,
          }}>
          <AppIcon name="archive" color={theme.colors.mutedText} size={13} />
          <AppText
            style={{
              color: theme.colors.mutedText,
              fontFamily: staticTheme.fonts.sansMedium,
              fontSize: 13,
              flex: 1,
            }}>
            {pastTrips.length} past {pastTrips.length === 1 ? 'trip' : 'trips'}
          </AppText>
          <AppIcon
            name={pastExpanded ? 'chevron-up' : 'chevron-down'}
            color={theme.colors.mutedText}
            size={13}
          />
        </Pressable>
      )}

      {/* Past trips (expanded) */}
      {pastExpanded && pastTrips.map((trip) => (
        <SavedTripCard
          key={trip.id}
          trip={trip}
          onPress={() => onOpenTrip(trip)}
          onDelete={() => deleteSavedTrip(trip.id)}
        />
      ))}

      {/* Upcoming trips */}
      {upcomingTrips.length === 0 && pastTrips.length > 0 ? (
        <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center', paddingVertical: spacing.md }}>
          No upcoming trips saved.
        </AppText>
      ) : (
        upcomingTrips.map((trip) => (
          <SavedTripCard
            key={trip.id}
            trip={trip}
            onPress={() => onOpenTrip(trip)}
            onDelete={() => deleteSavedTrip(trip.id)}
          />
        ))
      )}
    </View>
  );
}
