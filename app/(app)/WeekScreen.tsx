import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTierHref } from '@/lib/look-route';
import { formatTierLabel, weatherIconName } from '@/lib/outfit-utils';
import { buildSavedOutfitId } from '@/lib/saved-outfits-storage';
import { getNextSevenDays } from '@/lib/week-plan-storage';
import { formatTemperatureRange } from '@/lib/temperature-format';
import { useAppSession } from '@/hooks/use-app-session';
import { useWeekPlan } from './useWeekPlan';
import { useWeekPlanActions } from './useWeekPlanActions';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function WeekScreen() {
  const { theme } = useTheme();
  const { profile } = useAppSession();
  const { items, setItems, savedOutfitIds, setSavedOutfitIds, forecastByDay, isLoadingWeek } = useWeekPlan();
  const { savingId, handleSave, handleRemove } = useWeekPlanActions({ savedOutfitIds, setItems, setSavedOutfitIds });

  const days = getNextSevenDays();

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 2 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">Your Week</AppText>
          <AppText tone="muted">Plan today and the next 7 days of outfits.</AppText>
        </View>

        {isLoadingWeek ? (
          <LoadingState label="Loading your week..." />
        ) : null}

        {!isLoadingWeek
          ? days.map((day) => {
            const assignment = items.find((item) => item.dayKey === day.dayKey);
            const forecast = forecastByDay[day.dayKey];

            if (!assignment) {
              return (
                <View
                  key={day.dayKey}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: 28,
                    borderWidth: 1,
                    gap: spacing.xs,
                    padding: spacing.lg,
                  }}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                    {forecast ? (
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                        <Ionicons color={theme.colors.subtleText} name={weatherIconName(forecast.weatherCode)} size={16} />
                        <AppText tone="muted">{formatTemperatureRange(forecast.highTempC, forecast.lowTempC, profile.temperatureUnit)}</AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText tone="muted">Nothing planned yet.</AppText>
                </View>
              );
            }

            const savedId = buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier);
            const isSaved = savedOutfitIds.includes(savedId);
            const isSaving = savingId === savedId;

            return (
              <Link
                key={day.dayKey}
                href={buildTierHref(
                  assignment.recommendation.tier,
                  assignment.requestId,
                  assignment.input,
                  assignment.recommendation
                )}
                asChild>
                <Pressable
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: 28,
                    borderWidth: 1,
                    gap: spacing.md,
                    padding: spacing.lg,
                  }}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                      <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                      {forecast ? (
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                          <Ionicons color={theme.colors.subtleText} name={weatherIconName(forecast.weatherCode)} size={16} />
                          <AppText tone="muted">{formatTemperatureRange(forecast.highTempC, forecast.lowTempC, profile.temperatureUnit)}</AppText>
                        </View>
                      ) : null}
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleRemove(day.dayKey);
                      }}>
                      <Ionicons color={theme.colors.danger} name="close" size={20} />
                    </Pressable>
                  </View>

                  {assignment.recommendation.sketchImageUrl ? (
                    <RemoteImagePanel
                      uri={assignment.recommendation.sketchImageUrl}
                      aspectRatio={3 / 4}
                      resizeMode="contain"
                      minHeight={220}
                      fallbackTitle="Sketch unavailable"
                      fallbackMessage="The planned illustration could not be displayed."
                    />
                  ) : null}

                  <Pressable
                    disabled={isSaved}
                    onPress={(event) => {
                      event.stopPropagation();
                      void handleSave(assignment);
                    }}
                    style={{
                      alignItems: 'center',
                      backgroundColor: isSaved ? theme.colors.border : theme.colors.card,
                      borderColor: theme.colors.border,
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: 'row',
                      gap: spacing.xs,
                      justifyContent: 'center',
                      minHeight: 48,
                      paddingHorizontal: spacing.md,
                    }}>
                    <Ionicons
                      color={theme.colors.text}
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                    />
                    <AppText>
                      {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}
                    </AppText>
                  </Pressable>

                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="title">{assignment.recommendation.title}</AppText>
                    <AppText tone="muted">{formatTierLabel(assignment.recommendation.tier)}</AppText>
                  </View>
                </Pressable>
              </Link>
            );
          })
          : null}

        {!isLoadingWeek && !items.length ? (
          <EmptyState
            title="No week planned yet"
            message="Add outfits from the result page to assign them to today and the next 7 days."
            actionLabel="Create a look"
            actionHref="/create-look"
          />
        ) : null}
      </View>
    </AppScreen>
  );
}
