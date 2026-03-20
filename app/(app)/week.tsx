import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Link } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { spacing, theme } from '@/constants/theme';
import { buildTierHref } from '@/lib/look-route';
import { getNextSevenDays, loadWeekPlan, removeWeekPlan } from '@/lib/week-plan-storage';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

export default function WeekScreen() {
  const [items, setItems] = useState<WeekPlannedOutfit[]>([]);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [forecastByDay, setForecastByDay] = useState<Record<string, WeekForecastDay>>({});
  const isFocused = useIsFocused();
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const [nextItems, savedOutfits, forecast] = await Promise.all([
        loadWeekPlan(),
        loadSavedOutfits(),
        loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
      ]);
      if (isMounted) {
        setItems(nextItems);
        setSavedOutfitIds(savedOutfits.map((item) => item.id));
        setForecastByDay(Object.fromEntries(forecast.map((day) => [day.dayKey, day])));
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  const days = getNextSevenDays();

  async function handleSave(assignment: WeekPlannedOutfit) {
    const savedId = buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier);
    if (savedOutfitIds.includes(savedId)) {
      return;
    }

    setSavingId(savedId);

    try {
      await saveSavedOutfit(assignment.input, assignment.recommendation, assignment.requestId);
      setSavedOutfitIds((current) => [...current, savedId]);
      showToast('Outfit saved to favorites.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }

    setSavingId(null);
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader title="Week" subtitle="Plan your next 7 days of outfits." />
        {days.map((day) => {
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
                      <AppText tone="muted">{`${Math.round(forecast.highTempC)}° / ${Math.round(forecast.lowTempC)}°C`}</AppText>
                    </View>
                  ) : null}
                </View>
                <AppText tone="muted">Nothing planned yet.</AppText>
              </View>
            );
          }

          return (
            <Link
              key={day.dayKey}
              href={buildTierHref(
                assignment.recommendation.tier,
                assignment.requestId,
                assignment.input,
                assignment.recommendation,
                0
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
                        <AppText tone="muted">{`${Math.round(forecast.highTempC)}° / ${Math.round(forecast.lowTempC)}°C`}</AppText>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={async (event) => {
                      event.stopPropagation();
                      setItems(await removeWeekPlan(day.dayKey));
                    }}>
                    <Ionicons color={theme.colors.danger} name="close" size={20} />
                  </Pressable>
                </View>
                {assignment.recommendation.sketchImageUrl ? (
                  <RemoteImagePanel
                    uri={assignment.recommendation.sketchImageUrl}
                    aspectRatio={4 / 5}
                    minHeight={220}
                    fallbackTitle="Sketch unavailable"
                    fallbackMessage="The planned illustration could not be displayed."
                  />
                ) : null}
                <Pressable
                  disabled={savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))}
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleSave(assignment);
                  }}
                  style={{
                    alignItems: 'center',
                    backgroundColor: savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))
                      ? theme.colors.border
                      : theme.colors.card,
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
                    name={savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)) ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                  />
                  <AppText>
                    {savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))
                      ? 'Saved'
                      : savingId === buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)
                        ? 'Saving...'
                        : 'Save outfit'}
                  </AppText>
                </Pressable>
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="title">{assignment.recommendation.title}</AppText>
                  <AppText tone="muted">{formatTierLabel(assignment.recommendation.tier)}</AppText>
                </View>
              </Pressable>
            </Link>
          );
        })}
        {!items.length ? (
          <EmptyState
            title="No week planned yet"
            message="Add outfits from the result page to assign them to the next 7 days."
            actionLabel="Create a look"
            actionHref="/(app)/create-look"
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

function formatTierLabel(tier: WeekPlannedOutfit['recommendation']['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function weatherIconName(code: number): React.ComponentProps<typeof Ionicons>['name'] {
  if (code === 0) return 'sunny-outline';
  if ([1, 2, 3].includes(code)) return 'partly-sunny-outline';
  if ([45, 48].includes(code)) return 'cloud-outline';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy-outline';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow-outline';
  if ([95, 96, 99].includes(code)) return 'thunderstorm-outline';
  return 'cloud-outline';
}
