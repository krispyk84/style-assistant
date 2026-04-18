import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { TripDayCard } from '@/components/cards/trip-day-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripResultsScreen() {
  const { tripId, destination } = useLocalSearchParams<{ tripId: string; destination: string }>();

  const [days, setDays] = useState<TripOutfitDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track active sketch poll intervals keyed by dayId
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    if (!tripId) { setErrorMessage('Missing trip ID.'); setIsLoading(false); return; }

    tripOutfitsStorage.load(tripId).then((plan) => {
      if (!plan) { setErrorMessage('Trip plan not found. Please go back and try again.'); }
      else { setDays(plan.days); }
      setIsLoading(false);
    });
  }, [tripId]);

  // Clear all intervals on unmount
  useEffect(() => {
    return () => { Object.values(pollIntervals.current).forEach(clearInterval); };
  }, []);

  // ── Sketch handlers ─────────────────────────────────────────────────────────

  async function handleGenerateSketch(day: TripOutfitDay) {
    if (!tripId) return;

    // Optimistic — set loading
    const updatedLoading: TripOutfitDay = { ...day, sketchStatus: 'loading' };
    setDays((prev) => prev.map((d) => (d.id === day.id ? updatedLoading : d)));

    try {
      const { jobId } = await tripOutfitsService.startDaySketch({
        destination: destination ?? '',
        dayTitle: day.title,
        climateLabel: '',   // contextual — not critical for sketch
        pieces: day.pieces,
        shoes: day.shoes,
        accessories: day.accessories,
      });

      // Patch in jobId
      const withJob: TripOutfitDay = { ...updatedLoading, sketchJobId: jobId };
      setDays((prev) => prev.map((d) => (d.id === day.id ? withJob : d)));
      await tripOutfitsStorage.updateDay(tripId, withJob);

      // Start polling
      startSketchPoll(day.id, jobId, tripId);
    } catch {
      const failed: TripOutfitDay = { ...day, sketchStatus: 'failed' };
      setDays((prev) => prev.map((d) => (d.id === day.id ? failed : d)));
      await tripOutfitsStorage.updateDay(tripId, failed);
    }
  }

  function startSketchPoll(dayId: string, jobId: string, tid: string) {
    // Clear any previous poll for this day
    if (pollIntervals.current[dayId]) clearInterval(pollIntervals.current[dayId]);

    pollIntervals.current[dayId] = setInterval(async () => {
      try {
        const status = await tripOutfitsService.getDaySketchStatus(jobId);

        if (status.sketchStatus === 'ready' && status.sketchImageUrl) {
          clearInterval(pollIntervals.current[dayId]);
          delete pollIntervals.current[dayId];

          const sketchUrl = status.sketchImageUrl;
          let updatedDay: TripOutfitDay | undefined;
          setDays((prev) => {
            const next = prev.map((d) => {
              if (d.id !== dayId) return d;
              updatedDay = { ...d, sketchStatus: 'ready', sketchUrl, sketchJobId: jobId };
              return updatedDay;
            });
            return next;
          });
          if (updatedDay) await tripOutfitsStorage.updateDay(tid, updatedDay);
        } else if (status.sketchStatus === 'failed') {
          clearInterval(pollIntervals.current[dayId]);
          delete pollIntervals.current[dayId];

          setDays((prev) =>
            prev.map((d) => (d.id === dayId ? { ...d, sketchStatus: 'failed' } : d))
          );
        }
      } catch {
        // Network glitch — keep polling
      }
    }, 4000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppScreen scrollable backButton topInset>
      <View style={{ gap: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Trip Outfit Plan</AppText>
          <AppText tone="muted">{destination ?? 'Your trip'}</AppText>
        </View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <ActivityIndicator size="large" />
          </View>
        ) : errorMessage ? (
          <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
            {errorMessage}
          </AppText>
        ) : (
          days.map((day) => (
            <TripDayCard
              key={day.id}
              day={day}
              onGenerateSketch={() => void handleGenerateSketch(day)}
            />
          ))
        )}
      </View>
    </AppScreen>
  );
}
