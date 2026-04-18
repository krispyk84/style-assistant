import { useState } from 'react';

import { AppIcon, weatherIcon } from '@/components/ui/app-icon';
import { Pressable, View } from 'react-native';

import { WeatherForecastModal } from '@/components/weather/weather-forecast-modal';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useAppSession } from '@/hooks/use-app-session';
import { formatTemperature } from '@/lib/temperature-format';
import type { WeatherContext } from '@/types/weather';

type WeatherCardProps = {
  weather: WeatherContext | null;
  isLoading?: boolean;
  errorMessage?: string | null;
};

export function WeatherCard({ weather, isLoading = false, errorMessage }: WeatherCardProps) {
  const { profile } = useAppSession();
  const { theme } = useTheme();
  const [forecastVisible, setForecastVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => weather ? setForecastVisible(true) : undefined}
        style={({ pressed }) => ({
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 28,
          borderWidth: 1,
          gap: spacing.md,
          opacity: pressed && weather ? 0.85 : 1,
          padding: spacing.lg,
        })}>
        {isLoading ? (
          <AppText tone="muted">Checking the weather so your looks fit the day.</AppText>
        ) : weather ? (
          <>
            {/* Icon + temp row */}
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
                <AppIcon
                  color={theme.colors.accent}
                  name={weatherIcon(weather.weatherCode)}
                  size={24}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.4 }}>
                  {[weather.locationLabel, weather.season.charAt(0).toUpperCase() + weather.season.slice(1)]
                    .filter(Boolean)
                    .join(' • ')}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <AppText variant="title">
                    {formatTemperature(weather.temperatureC, profile.temperatureUnit)}
                    {' — '}
                    {weather.summary}
                  </AppText>
                </View>
                {(weather.dailyHighC !== null || weather.dailyLowC !== null) ? (
                  <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginTop: 2 }}>
                    {weather.dailyHighC !== null ? (
                      <AppText style={{ fontSize: 13, color: theme.colors.text }}>
                        H: {formatTemperature(weather.dailyHighC, profile.temperatureUnit)}
                      </AppText>
                    ) : null}
                    {weather.dailyHighC !== null && weather.dailyLowC !== null ? (
                      <AppText tone="subtle" style={{ fontSize: 13 }}>·</AppText>
                    ) : null}
                    {weather.dailyLowC !== null ? (
                      <AppText tone="muted" style={{ fontSize: 13 }}>
                        L: {formatTemperature(weather.dailyLowC, profile.temperatureUnit)}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {/* Tap indicator */}
              <AppIcon color={theme.colors.subtleText} name="chevron-right" size={16} />
            </View>

            {/* Styling hint */}
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
      </Pressable>

      <WeatherForecastModal
        visible={forecastVisible}
        onClose={() => setForecastVisible(false)}
      />
    </>
  );
}
