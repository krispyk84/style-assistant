import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';
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
        gap: spacing.sm,
        padding: spacing.lg,
      }}>
      <AppText variant="sectionTitle">Current weather</AppText>
      {isLoading ? (
        <AppText tone="muted">Checking the weather so your looks fit the day.</AppText>
      ) : weather ? (
        <>
          <AppText variant="title">
            {formatTemperature(weather.temperatureC, profile.temperatureUnit)}
            {weather.locationLabel ? ` · ${weather.locationLabel}` : ''}
          </AppText>
          <AppText tone="muted">
            {weather.summary} • {weather.season.charAt(0).toUpperCase() + weather.season.slice(1)}
          </AppText>
          <AppText tone="muted">{weather.stylingHint}</AppText>
        </>
      ) : (
        <AppText tone="muted">
          {errorMessage ?? 'Weather is unavailable right now, so outfit choices will rely on your anchor item and profile only.'}
        </AppText>
      )}
    </View>
  );
}
