import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { TripDayCard } from '@/components/cards/trip-day-card';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildPackingListHref } from '@/lib/trip-route';
import { useTripResultsActions } from './useTripResultsActions';
import { useTripResultsData } from './useTripResultsData';
import { useTripSketchPolling } from './useTripSketchPolling';

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

  const {
    plan,
    days,
    setDays,
    isLoading,
    errorMessage,
    progressDay,
    totalProgressDays,
    closetItems,
  } = useTripResultsData({ tripId, savedTripId, isProgressive });
  const { startSketchPoll, stopSketchPoll } = useTripSketchPolling({ setDays });
  const {
    regeneratingDays,
    isSaving,
    savedDbId,
    handleGenerateSketch,
    handleLove,
    handleHate,
    handleSaveTrip,
  } = useTripResultsActions({
    plan,
    days,
    setDays,
    tripId,
    savedTripId,
    startSketchPoll,
    stopSketchPoll,
  });

  // ── Packing list navigation ──────────────────────────────────────────────────

  function handleOpenPackingList() {
    const activeTripId = plan?.tripId ?? tripId;
    if (!activeTripId) return;
    router.push(buildPackingListHref({ tripId: activeTripId, savedTripId }));
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
