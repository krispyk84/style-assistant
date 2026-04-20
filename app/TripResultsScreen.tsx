import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { TripDayCard } from '@/components/cards/trip-day-card';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { StoredTripPlan } from '@/lib/trip-outfits-storage';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { savedTripsService } from '@/services/saved-trips';
import { closetService } from '@/services/closet';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';

// ── Screen ────────────────────────────────────────────────────────────────────

export function TripResultsScreen() {
  const { tripId, destination, savedTripId, isProgressiveGeneration } = useLocalSearchParams<{
    tripId: string;
    destination: string;
    savedTripId?: string;
    isProgressiveGeneration?: string;
  }>();
  const { theme } = useTheme();

  const isProgressive = isProgressiveGeneration === '1';

  const [plan, setPlan] = useState<StoredTripPlan | null>(null);
  const [days, setDays] = useState<TripOutfitDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingDays, setRegeneratingDays] = useState<Set<string>>(new Set());

  // Progressive generation progress
  const [progressDay, setProgressDay] = useState(0);
  const [totalProgressDays, setTotalProgressDays] = useState(0);

  // Save button state
  const [isSaving, setIsSaving] = useState(false);
  const [savedDbId, setSavedDbId] = useState<string | null>(savedTripId ?? null);

  // Closet items for match indicators
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  // Track active sketch poll intervals keyed by dayId
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const progressiveRunning = useRef(false);

  // Load closet items for match indicators (best-effort, non-blocking)
  useEffect(() => {
    closetService.getItems().then((res) => {
      if (res.success && res.data) setClosetItems(res.data.items ?? []);
    }).catch(() => {});
  }, []);

  // ── Progressive generation ─────────────────────────────────────────────────

  const runProgressiveGeneration = useCallback(async (tid: string) => {
    if (progressiveRunning.current) return;
    progressiveRunning.current = true;

    const draft = await tripDraftStorage.load().catch(() => null);
    if (!draft) {
      setErrorMessage('Trip details not found. Please go back and try again.');
      setIsLoading(false);
      progressiveRunning.current = false;
      return;
    }

    const totalDays = Math.min(8, draft.numDays);
    setTotalProgressDays(totalDays);
    setProgressDay(0);

    const planMeta: StoredTripPlan = {
      tripId: tid,
      destination:   draft.destinationLabel,
      country:       draft.country,
      departureDate: draft.departureDate,
      returnDate:    draft.returnDate,
      travelParty:   draft.travelParty,
      climateLabel:  draft.climateLabel,
      avgHighC:      draft.avgHighC,
      avgLowC:       draft.avgLowC,
      styleVibe:     draft.styleVibe,
      purposes:      draft.purposes,
      activities:    draft.activities,
      dressCode:     draft.dressCode,
      days:          [],
      generatedAt:   new Date().toISOString(),
    };

    await tripOutfitsStorage.save(planMeta);

    const generatedDays: TripOutfitDay[] = [];

    for (let i = 0; i < totalDays; i++) {
      setProgressDay(i);

      const previousDaysSummary = generatedDays.map((d) =>
        `Day ${d.dayIndex + 1} (${d.date}, ${d.dayType}): ${d.pieces.join(', ')}${d.shoes ? `, ${d.shoes}` : ''}`
      );

      let result;
      try {
        result = await tripOutfitsService.generateTripOutfits({
          tripId: tid,
          destination:    draft.destinationLabel,
          country:        draft.country,
          departureDate:  draft.departureDate,
          returnDate:     draft.returnDate,
          travelParty:    draft.travelParty,
          purposes:       draft.purposes,
          climateLabel:   draft.climateLabel,
          avgHighC:       draft.avgHighC,
          avgLowC:        draft.avgLowC,
          tempBand:       draft.tempBand,
          precipChar:     draft.precipChar,
          packingTag:     draft.packingTag,
          dressSeason:    draft.dressSeason,
          activities:     draft.activities,
          dressCode:      draft.dressCode,
          styleVibe:      draft.styleVibe,
          willSwim:       draft.willSwim,
          fancyNights:    draft.fancyNights,
          workoutClothes: draft.workoutClothes,
          laundryAccess:  draft.laundryAccess,
          shoesCount:     draft.shoesCount,
          carryOnOnly:    draft.carryOnOnly,
          specialNeeds:   draft.specialNeeds,
          anchors:        draft.pendingAnchors,
          anchorMode:     draft.pendingAnchorMode,
          generateOnlyDayIndex:  i,
          previousDaysSummary,
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Generation failed. Please go back and try again.');
        setIsLoading(false);
        progressiveRunning.current = false;
        return;
      }

      const newDay = result.days[0];
      if (!newDay) continue;

      generatedDays.push(newDay);
      setDays([...generatedDays]);

      if (i === 0) {
        setPlan({ ...planMeta, days: generatedDays });
        setIsLoading(false);
      }

      await tripOutfitsStorage.appendDay(tid, newDay);
    }

    // All days done — update plan with full list and clear draft
    setPlan((prev) => prev ? { ...prev, days: generatedDays } : null);
    setTotalProgressDays(0); // hides the "still generating" indicator
    void tripDraftStorage.clear();
    progressiveRunning.current = false;
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tripId && !savedTripId) {
      setErrorMessage('Missing trip ID.');
      setIsLoading(false);
      return;
    }

    if (savedTripId) {
      savedTripsService.getById(savedTripId).then((detail) => {
        const fakePlan: StoredTripPlan = {
          tripId: detail.tripId,
          destination: detail.destination,
          country: detail.country,
          departureDate: detail.departureDate,
          returnDate: detail.returnDate,
          travelParty: detail.travelParty,
          climateLabel: detail.climateLabel,
          styleVibe: detail.styleVibe,
          purposes: detail.purposes,
          activities: detail.activities,
          dressCode: detail.dressCode,
          days: detail.days,
          generatedAt: detail.savedAt,
        };
        setPlan(fakePlan);
        setDays(detail.days);
        setIsLoading(false);
      }).catch(() => {
        setErrorMessage('Could not load saved trip. Please try again.');
        setIsLoading(false);
      });
      return;
    }

    if (isProgressive) {
      void runProgressiveGeneration(tripId!);
      return;
    }

    tripOutfitsStorage.load(tripId!).then((loaded) => {
      if (!loaded) { setErrorMessage('Trip plan not found. Please go back and try again.'); }
      else { setPlan(loaded); setDays(loaded.days); }
      setIsLoading(false);
    }).catch(() => {
      setErrorMessage('Could not load trip. Please go back and try again.');
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan) return;

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
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, withJob);

      startSketchPoll(day.id, jobId, activeTripId);
    } catch {
      const failed: TripOutfitDay = { ...day, sketchStatus: 'failed' };
      setDays((prev) => prev.map((d) => (d.id === day.id ? failed : d)));
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, failed);
    }
  }

  // ── Love / Hate handlers ────────────────────────────────────────────────────

  async function handleLove(day: TripOutfitDay) {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId) return;
    const newFeedback = day.feedback === 'love' ? null : 'love' as const;
    const updated: TripOutfitDay = { ...day, feedback: newFeedback };
    setDays((prev) => prev.map((d) => (d.id === day.id ? updated : d)));
    if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, updated);
  }

  async function handleHate(day: TripOutfitDay) {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId || !plan) return;

    if (pollIntervals.current[day.id]) {
      clearInterval(pollIntervals.current[day.id]);
      delete pollIntervals.current[day.id];
    }

    setRegeneratingDays((prev) => new Set(prev).add(day.id));

    try {
      const newDay = await tripOutfitsService.regenerateDay({
        tripId: activeTripId,
        dayIndex: day.dayIndex,
        date: day.date,
        dayType: day.dayType,
        destination: plan.destination,
        country: plan.country,
        climateLabel: plan.climateLabel,
        avgHighC: plan.avgHighC,
        avgLowC: plan.avgLowC,
        activities: plan.activities,
        dressCode: plan.dressCode,
        styleVibe: plan.styleVibe,
        purposes: plan.purposes,
        previousPieces: day.pieces,
        previousShoes: day.shoes,
      });

      setDays((prev) => prev.map((d) => (d.id === day.id ? newDay : d)));
      if (!savedTripId) await tripOutfitsStorage.updateDay(activeTripId, newDay);
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

  // ── Save trip handler ───────────────────────────────────────────────────────

  async function handleSaveTrip() {
    if (!plan || isSaving) return;
    setIsSaving(true);
    try {
      const daysToSave = days.map((d) =>
        d.sketchStatus === 'loading' ? { ...d, sketchStatus: 'not_started' as const } : d,
      );
      const saved = await savedTripsService.save({
        tripId: plan.tripId,
        destination: plan.destination,
        country: plan.country,
        departureDate: plan.departureDate ?? '',
        returnDate: plan.returnDate ?? '',
        travelParty: plan.travelParty ?? 'Solo',
        climateLabel: plan.climateLabel,
        styleVibe: plan.styleVibe,
        purposes: plan.purposes,
        activities: plan.activities,
        dressCode: plan.dressCode,
        days: daysToSave,
      });
      setSavedDbId(saved.id);
    } catch {
      // Fail silently — user can retry
    } finally {
      setIsSaving(false);
    }
  }

  // ── Packing list navigation ──────────────────────────────────────────────────

  function handleOpenPackingList() {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId) return;
    router.push({
      pathname: '/packing-list',
      params: savedTripId
        ? { tripId: activeTripId, savedTripId }
        : { tripId: activeTripId },
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showContent = !isLoading && !errorMessage;
  const isSaved = savedDbId !== null;
  const isStillGenerating = isProgressive && totalProgressDays > 0 && !isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + 72, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.back()}
              style={{ padding: spacing.xs }}>
              <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heroSmall">Trip Outfit Plan</AppText>
              <AppText tone="muted">{destination ?? plan?.destination ?? 'Your trip'}</AppText>
            </View>
          </View>

          {/* Save trip button — below title */}
          {showContent && (
            <Pressable
              onPress={isSaved ? undefined : () => void handleSaveTrip()}
              disabled={isSaving}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: isSaved ? theme.colors.subtleSurface : theme.colors.text,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm - 1,
              }}>
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.inverseText} />
              ) : (
                <AppIcon
                  name={isSaved ? 'bookmark-filled' : 'bookmark'}
                  color={isSaved ? theme.colors.accent : theme.colors.inverseText}
                  size={13}
                />
              )}
              <AppText style={{
                color: isSaved ? theme.colors.mutedText : theme.colors.inverseText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 12,
                letterSpacing: 0.4,
              }}>
                {isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save Trip'}
              </AppText>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            {isProgressive && (
              <>
                <AppText variant="sectionTitle">Building your plan…</AppText>
                {totalProgressDays > 0 && (
                  <AppText tone="muted">
                    Day {progressDay + 1} of {totalProgressDays}
                  </AppText>
                )}
              </>
            )}
          </View>
        ) : errorMessage ? (
          <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
            {errorMessage}
          </AppText>
        ) : (
          <>
            {days.map((day) => (
              <TripDayCard
                key={day.id}
                day={day}
                closetItems={closetItems}
                isRegenerating={regeneratingDays.has(day.id)}
                onGenerateSketch={() => void handleGenerateSketch(day)}
                onLove={() => void handleLove(day)}
                onHate={() => void handleHate(day)}
              />
            ))}

            {/* Progressive generation "still building" footer */}
            {isStillGenerating && (
              <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
                <ActivityIndicator color={theme.colors.accent} />
                <AppText tone="muted" style={{ fontSize: 13 }}>
                  Day {progressDay + 1} of {totalProgressDays}…
                </AppText>
              </View>
            )}
          </>
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

export { TripResultsScreen as default };
