import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { savedTripsService } from '@/services/saved-trips';
import type { SavedTripSummary } from '@/services/saved-trips';
import { splitTripsByDate } from './travel-planner-mappers';

export function useSavedTripsData() {
  const [savedTrips, setSavedTrips] = useState<SavedTripSummary[]>([]);
  const [savedTripsLoading, setSavedTripsLoading] = useState(false);
  const [savedTripsError, setSavedTripsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  const loadSavedTrips = useCallback(() => {
    setSavedTripsLoading(true);
    setSavedTripsError(null);
    savedTripsService
      .list()
      .then((trips) => {
        setSavedTrips(trips);
      })
      .catch(() => {
        setSavedTripsError('Could not load saved trips.');
      })
      .finally(() => {
        setSavedTripsLoading(false);
      });
  }, []);

  const deleteSavedTrip = useCallback((id: string) => {
    if (deletingId) return;
    Alert.alert(
      'Delete Trip',
      'Remove this saved trip? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await savedTripsService.delete(id);
              setSavedTrips((prev) => prev.filter((trip) => trip.id !== id));
            } catch {
              // Keep the existing quiet failure behavior for this screen.
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, [deletingId]);

  const groupedTrips = useMemo(() => splitTripsByDate(savedTrips), [savedTrips]);

  return {
    savedTrips,
    savedTripsLoading,
    savedTripsError,
    deletingId,
    pastExpanded,
    setPastExpanded,
    upcomingTrips: groupedTrips.upcoming,
    pastTrips: groupedTrips.past,
    loadSavedTrips,
    deleteSavedTrip,
  };
}
