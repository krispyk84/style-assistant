import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { TripDayCard } from '@/components/cards/trip-day-card';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripResultsScreen() {
  const { tripId, destination } = useLocalSearchParams<{ tripId: string; destination: string }>();
  const { theme } = useTheme();

  const [plan, setPlan] = useState<StoredTripPlan | null>(null);
  const [days, setDays] = useState<TripOutfitDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingDays, setRegeneratingDays] = useState<Set<string>>(new Set());

  // Track active sketch poll intervals keyed by dayId
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    if (!tripId) { setErrorMessage('Missing trip ID.'); setIsLoading(false); return; }

    tripOutfitsStorage.load(tripId).then((loaded) => {
      if (!loaded) { setErrorMessage('Trip plan not found. Please go back and try again.'); }
      else { setPlan(loaded); setDays(loaded.days); }
      setIsLoading(false);
    });
  }, [tripId]);

  // Clear all intervals on unmount
  useEffect(() => {
    return () => { Object.values(pollIntervals.current).forEach(clearInterval); };
  }, []);

  // ── Sketch handlers ─────────────────────────────────────────────────────────

  const startSketchPoll = useCallback((dayId: string, jobId: string, tid: string) => {
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
  }, []);

  async function handleGenerateSketch(day: TripOutfitDay) {
    if (!tripId || !plan) return;

    const updatedLoading: TripOutfitDay = { ...day, sketchStatus: 'loading' };
    setDays((prev) => prev.map((d) => (d.id === day.id ? updatedLoading : d)));

    try {
      const { jobId } = await tripOutfitsService.startDaySketch({
        destination: plan.destination,
        dayTitle: day.title,
        climateLabel: plan.climateLabel,
        pieces: day.pieces,
        shoes: day.shoes,
        accessories: day.accessories,
      });

      const withJob: TripOutfitDay = { ...updatedLoading, sketchJobId: jobId };
      setDays((prev) => prev.map((d) => (d.id === day.id ? withJob : d)));
      await tripOutfitsStorage.updateDay(tripId, withJob);

      startSketchPoll(day.id, jobId, tripId);
    } catch {
      const failed: TripOutfitDay = { ...day, sketchStatus: 'failed' };
      setDays((prev) => prev.map((d) => (d.id === day.id ? failed : d)));
      await tripOutfitsStorage.updateDay(tripId, failed);
    }
  }

  // ── Love / Hate handlers ────────────────────────────────────────────────────

  async function handleLove(day: TripOutfitDay) {
    if (!tripId) return;
    const newFeedback = day.feedback === 'love' ? null : 'love' as const;
    const updated: TripOutfitDay = { ...day, feedback: newFeedback };
    setDays((prev) => prev.map((d) => (d.id === day.id ? updated : d)));
    await tripOutfitsStorage.updateDay(tripId, updated);
  }

  async function handleHate(day: TripOutfitDay) {
    if (!tripId || !plan) return;

    // Clear any existing sketch poll for this day
    if (pollIntervals.current[day.id]) {
      clearInterval(pollIntervals.current[day.id]);
      delete pollIntervals.current[day.id];
    }

    setRegeneratingDays((prev) => new Set(prev).add(day.id));

    try {
      const newDay = await tripOutfitsService.regenerateDay({
        tripId,
        dayIndex: day.dayIndex,
        date: day.date,
        dayType: day.dayType,
        destination: plan.destination,
        country: plan.country,
        climateLabel: plan.climateLabel,
        activities: plan.activities,
        dressCode: plan.dressCode,
        styleVibe: plan.styleVibe,
        purposes: plan.purposes,
        previousPieces: day.pieces,
        previousShoes: day.shoes,
      });

      setDays((prev) => prev.map((d) => (d.id === day.id ? newDay : d)));
      await tripOutfitsStorage.updateDay(tripId, newDay);
    } catch {
      // Regeneration failed — leave the card as-is
    } finally {
      setRegeneratingDays((prev) => {
        const next = new Set(prev);
        next.delete(day.id);
        return next;
      });
    }
  }

  // ── Packing list navigation ──────────────────────────────────────────────────

  function handleOpenPackingList() {
    if (!tripId) return;
    router.push({ pathname: '/(app)/packing-list', params: { tripId } });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showContent = !isLoading && !errorMessage;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + 72, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: spacing.xs }}>
            <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heroSmall">Trip Outfit Plan</AppText>
            <AppText tone="muted">{destination ?? 'Your trip'}</AppText>
          </View>
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
              isRegenerating={regeneratingDays.has(day.id)}
              onGenerateSketch={() => void handleGenerateSketch(day)}
              onLove={() => void handleLove(day)}
              onHate={() => void handleHate(day)}
            />
          ))
        )}
      </ScrollView>

      {/* Fixed bottom — Packing List button */}
      {showContent && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            paddingTop: spacing.sm,
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}>
          <Pressable
            onPress={handleOpenPackingList}
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
            }}>
            <AppIcon name="suitcase" color={theme.colors.inverseText} size={16} />
            <AppText style={{
              color: theme.colors.inverseText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
              Packing List
            </AppText>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
