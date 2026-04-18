import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppIcon, weatherIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { BottomSheetModal } from '@/components/ui/bottom-sheet-modal';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatTemperature } from '@/lib/temperature-format';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import { useAppSession } from '@/hooks/use-app-session';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayKey(dayKey: string, index: number): string {
  const date = new Date(dayKey + 'T00:00:00');
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

type WeatherForecastModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function WeatherForecastModal({ visible, onClose }: WeatherForecastModalProps) {
  const { theme } = useTheme();
  const { profile } = useAppSession();
  const [forecast, setForecast] = useState<WeekForecastDay[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    setError(null);
    void loadNextSevenDayForecast()
      .then((days) => {
        setForecast(days);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load forecast.');
        setIsLoading(false);
      });
  }, [visible]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="75%">
      {/* Handle */}
      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 4, width: 40 }} />
      </View>

      {/* Header */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}>
        <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.8 }}>
          7-Day Forecast
        </AppText>
        <Pressable hitSlop={8} onPress={onClose}>
          <AppIcon color={theme.colors.mutedText} name="close" size={22} />
        </Pressable>
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      {/* Content */}
      {isLoading ? (
        <View style={{ alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={theme.colors.accent} />
          <AppText tone="muted" style={{ marginTop: spacing.sm, fontSize: 14 }}>
            Loading forecast...
          </AppText>
        </View>
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <AppText tone="muted" style={{ textAlign: 'center' }}>{error}</AppText>
        </View>
      ) : forecast ? (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {forecast.map((day, index) => (
            <View
              key={day.dayKey}
              style={{
                alignItems: 'center',
                borderBottomColor: theme.colors.border,
                borderBottomWidth: index < forecast.length - 1 ? 1 : 0,
                flexDirection: 'row',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <AppText
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: index === 0 ? theme.fonts.sansMedium : theme.fonts.sans,
                }}>
                {formatDayKey(day.dayKey, index)}
              </AppText>

              <View style={{ alignItems: 'center', width: 36 }}>
                <AppIcon
                  color={index === 0 ? theme.colors.accent : theme.colors.mutedText}
                  name={weatherIcon(day.weatherCode)}
                  size={20}
                />
              </View>

              <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                <AppText style={{ fontSize: 15 }}>
                  {formatTemperature(day.highTempC, profile.temperatureUnit)}
                  {'  '}
                  <AppText tone="muted" style={{ fontSize: 13 }}>
                    {formatTemperature(day.lowTempC, profile.temperatureUnit)}
                  </AppText>
                </AppText>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </BottomSheetModal>
  );
}
