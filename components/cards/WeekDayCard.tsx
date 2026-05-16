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

  // ── Empty / unplanned state — simple bordered card with day label + weather ──
  if (!assignment) {
    return (
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 24,
          borderWidth: 1,
          gap: spacing.xs,
          padding: spacing.lg,
        }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="sectionTitle">{day.dayLabel}</AppText>
          {forecast ? <WeatherBadge forecast={forecast} temperatureUnit={temperatureUnit} /> : null}
        </View>
        <AppText tone="muted">Nothing planned yet.</AppText>
      </View>
    );
  }

  // ── Planned state — edge-to-edge sketch on top, header + title + action below ──
  return (
    <Link
      href={buildTierHref(
        assignment.recommendation.tier,
        assignment.requestId,
        assignment.input,
        assignment.recommendation,
      )}
      asChild>
      <Pressable
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 24,
          borderWidth: 1,
          overflow: 'hidden',
        }}>
        <GeneratedSketchPanel
          mode="compact"
          status={assignment.recommendation.sketchStatus}
          imageUrl={assignment.recommendation.sketchImageUrl}
          aspectRatio={2 / 3}
          resizeMode="cover"
        />

        <View style={{ gap: spacing.md, padding: spacing.lg }}>
          {/* Day header + weather + remove */}
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', flex: 1, gap: spacing.sm }}>
              <AppText
                style={{
                  color: theme.colors.mutedText,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}>
                {day.dayLabel}
              </AppText>
              {forecast ? <WeatherBadge forecast={forecast} temperatureUnit={temperatureUnit} /> : null}
            </View>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove from this day"
              onPress={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.subtleSurface,
                borderRadius: 999,
                height: 28,
                justifyContent: 'center',
                width: 28,
              }}>
              <AppIcon color={theme.colors.mutedText} name="close" size={14} />
            </Pressable>
          </View>

          {/* Title + tier */}
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">{assignment.recommendation.title}</AppText>
            <AppText tone="muted">{formatTierLabel(assignment.recommendation.tier)}</AppText>
          </View>

          {/* Save action — small inline pill rather than full-width bar */}
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              disabled={isSaved}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Already saved to looks' : 'Save outfit to looks'}
              onPress={(event) => {
                event.stopPropagation();
                if (!isSaved) onSave();
              }}
              style={{
                alignItems: 'center',
                backgroundColor: isSaved ? theme.colors.subtleSurface : theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 1,
              }}>
              <AppIcon
                color={isSaved ? theme.colors.mutedText : theme.colors.text}
                name={isSaved ? 'bookmark-filled' : 'bookmark'}
                size={14}
              />
              <AppText
                style={{
                  color: isSaved ? theme.colors.mutedText : theme.colors.text,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 12,
                }}>
                {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}
              </AppText>
            </Pressable>
          </View>
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
      <AppIcon color={theme.colors.subtleText} name={weatherIcon(forecast.weatherCode)} size={14} />
      <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
        {formatTemperatureRange(forecast.highTempC, forecast.lowTempC, temperatureUnit)}
      </AppText>
    </View>
  );
}
