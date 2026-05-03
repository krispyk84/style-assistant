import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon, weatherIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTierHref } from '@/lib/look-route';
import { formatTierLabel } from '@/lib/outfit-utils';
import { formatTemperatureRange } from '@/lib/temperature-format';
import type { WeekForecastDay } from '@/services/weather/current-weather-service';
import type { TemperatureUnit } from '@/types/profile';
import type { WeekPlannedOutfit } from '@/types/style';

// ── Props ─────────────────────────────────────────────────────────────────────

type WeekDay = { dayKey: string; dayLabel: string };

export type WeekDayCardProps = {
  day: WeekDay;
  assignment?: WeekPlannedOutfit;
  forecast?: WeekForecastDay;
  temperatureUnit: TemperatureUnit;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onRemove: () => void;
};

// ── Card ──────────────────────────────────────────────────────────────────────

export function WeekDayCard({
  day,
  assignment,
  forecast,
  temperatureUnit,
  isSaved,
  isSaving,
  onSave,
  onRemove,
}: WeekDayCardProps) {
  const { theme } = useTheme();

  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: spacing.lg,
  } as const;

  if (!assignment) {
    return (
      <View style={[cardStyle, { gap: spacing.xs }]}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="sectionTitle">{day.dayLabel}</AppText>
          {forecast ? <WeatherBadge forecast={forecast} temperatureUnit={temperatureUnit} /> : null}
        </View>
        <AppText tone="muted">Nothing planned yet.</AppText>
      </View>
    );
  }

  return (
    <Link
      href={buildTierHref(
        assignment.recommendation.tier,
        assignment.requestId,
        assignment.input,
        assignment.recommendation,
      )}
      asChild>
      <Pressable style={[cardStyle, { gap: spacing.md }]}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="sectionTitle">{day.dayLabel}</AppText>
            {forecast ? <WeatherBadge forecast={forecast} temperatureUnit={temperatureUnit} /> : null}
          </View>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onRemove();
            }}>
            <AppIcon color={theme.colors.danger} name="close" size={20} />
          </Pressable>
        </View>

        <GeneratedSketchPanel
          status={assignment.recommendation.sketchStatus}
          imageUrl={assignment.recommendation.sketchImageUrl}
        />

        <Pressable
          disabled={isSaved}
          onPress={(event) => {
            event.stopPropagation();
            onSave();
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
          <AppIcon color={theme.colors.text} name="bookmark" size={18} />
          <AppText>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}</AppText>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="title">{assignment.recommendation.title}</AppText>
          <AppText tone="muted">{formatTierLabel(assignment.recommendation.tier)}</AppText>
        </View>
      </Pressable>
    </Link>
  );
}

// ── WeatherBadge ──────────────────────────────────────────────────────────────

function WeatherBadge({
  forecast,
  temperatureUnit,
}: {
  forecast: WeekForecastDay;
  temperatureUnit: TemperatureUnit;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
      <AppIcon color={theme.colors.subtleText} name={weatherIcon(forecast.weatherCode)} size={16} />
      <AppText tone="muted">
        {formatTemperatureRange(forecast.highTempC, forecast.lowTempC, temperatureUnit)}
      </AppText>
    </View>
  );
}
