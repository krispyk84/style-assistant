import { Pressable, View } from 'react-native';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon, weatherIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatTierLabel } from '@/lib/outfit-utils';
import { formatTemperatureRange } from '@/lib/temperature-format';
import type { ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';
import type { WeekForecastDay } from '@/services/weather/current-weather-service';
import type { TemperatureUnit } from '@/types/profile';

// Mirrors the planned state of components/cards/WeekDayCard.tsx for outfits
// built from the closet — no Link/navigation, since there's no tier-request
// detail route for these (the items ARE the real closet items already, not
// AI-suggested pieces needing a detail/match view).
export function ClosetWeekDayCard({
  day,
  assignment,
  forecast,
  temperatureUnit,
  isSaved,
  isSaving,
  onSave,
  onRemove,
}: {
  day: { dayKey: string; dayLabel: string };
  assignment: ClosetWeekPlanItem;
  forecast?: WeekForecastDay;
  temperatureUnit: TemperatureUnit;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <GeneratedSketchPanel
        mode="compact"
        status={assignment.outfit.sketchStatus}
        imageUrl={assignment.outfit.sketchImageUrl}
        aspectRatio={2 / 3}
        resizeMode="cover"
      />

      <View style={{ gap: spacing.md, padding: spacing.lg }}>
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
            {forecast ? (
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                <AppIcon color={theme.colors.subtleText} name={weatherIcon(forecast.weatherCode)} size={14} />
                <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
                  {formatTemperatureRange(forecast.highTempC, forecast.lowTempC, temperatureUnit)}
                </AppText>
              </View>
            ) : null}
          </View>
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove from this day"
            onPress={onRemove}
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

        <View style={{ gap: spacing.xs }}>
          <AppText variant="sectionTitle">{assignment.outfit.title}</AppText>
          <AppText tone="muted">{formatTierLabel(assignment.formality)} · from your closet</AppText>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <Pressable
            disabled={isSaved || isSaving}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Already saved to looks' : 'Save outfit to looks'}
            onPress={onSave}
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
    </View>
  );
}
