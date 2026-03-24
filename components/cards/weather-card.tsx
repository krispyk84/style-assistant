import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';
import { weatherIconName } from '@/lib/outfit-utils';
import { formatTemperature } from '@/lib/temperature-format';
import { AppText } from '@/components/ui/app-text';
import type { WeatherContext } from '@/types/weather';

type WeatherCardProps = {
  weather: WeatherContext | null;
  isLoading?: boolean;
  errorMessage?: string | null;
};

export function WeatherCard({ weather, isLoading = false, errorMessage }: WeatherCardProps) {
  const { profile } = useAppSession();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}>
      {isLoading ? (
        <AppText tone="muted">Checking the weather so your looks fit the day.</AppText>
      ) : weather ? (
        <>
          {/* Icon + location row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.card,
                borderRadius: 999,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}>
              <Ionicons
                color={theme.colors.accent}
                name={weatherIconName(weather.weatherCode)}
                size={24}
              />
            </View>
            <View style={{ gap: 2 }}>
              <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.4 }}>
                {[weather.locationLabel, weather.season.charAt(0).toUpperCase() + weather.season.slice(1)]
                  .filter(Boolean)
                  .join(' • ')}
              </AppText>
              <AppText variant="title">
                {formatTemperature(weather.temperatureC, profile.temperatureUnit)}
                {' — '}
                {weather.summary}
              </AppText>
            </View>
          </View>

          {/* Styling hint blockquote */}
          {weather.stylingHint ? (
            <View
              style={{
                borderLeftColor: theme.colors.accent,
                borderLeftWidth: 2,
                paddingLeft: spacing.md,
              }}>
              <AppText tone="muted" style={{ fontStyle: 'italic', lineHeight: 22 }}>
                "{weather.stylingHint}"
              </AppText>
            </View>
          ) : null}
        </>
      ) : (
        <AppText tone="muted">
          {errorMessage ??
            'Weather is unavailable right now — outfit choices will rely on your anchor item and profile only.'}
        </AppText>
      )}
    </View>
  );
}
