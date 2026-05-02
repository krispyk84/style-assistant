import { View } from 'react-native';

import { WeekDayCard } from '@/components/cards/WeekDayCard';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useAppSession } from '@/hooks/use-app-session';
import { buildSavedOutfitId } from '@/lib/saved-outfits-storage';
import { getNextSevenDays } from '@/lib/week-plan-storage';
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

        {isLoadingWeek ? <LoadingState label="Loading your week..." /> : null}

        {!isLoadingWeek
          ? days.map((day) => {
              const assignment = items.find((item) => item.dayKey === day.dayKey);
              const savedId = assignment
                ? buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)
                : null;
              return (
                <WeekDayCard
                  key={day.dayKey}
                  day={day}
                  assignment={assignment}
                  forecast={forecastByDay[day.dayKey]}
                  temperatureUnit={profile.temperatureUnit}
                  isSaved={savedId ? savedOutfitIds.includes(savedId) : false}
                  isSaving={savedId !== null && savingId === savedId}
                  onSave={() => assignment && void handleSave(assignment)}
                  onRemove={() => void handleRemove(day.dayKey)}
                />
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
