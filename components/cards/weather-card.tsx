import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import type { WeatherContext } from '@/types/weather';

type WeatherCardProps = {
  weather: WeatherContext | null;
  isLoading?: boolean;
  errorMessage?: string | null;
};

function getWeatherIcon(summary: string): keyof typeof Ionicons.glyphMap {
  const lower = summary.toLowerCase();
  if (lower.includes('sun') || lower.includes('clear')) return 'sunny-outline';
  if (lower.includes('cloud')) return 'cloudy-outline';
  if (lower.includes('rain')) return 'rainy-outline';
  if (lower.includes('snow')) return 'snow-outline';
  if (lower.includes('storm') || lower.includes('thunder')) return 'thunderstorm-outline';
  return 'partly-sunny-outline';
}

export function WeatherCard({ weather, isLoading = false, errorMessage }: WeatherCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          padding: spacing.lg,
        },
        theme.shadows.sm,
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="eyebrow" tone="subtle">Today's Weather</AppText>
          {isLoading ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <View style={{ width: 120, height: 28, backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.sm }} />
              <View style={{ width: 180, height: 20, backgroundColor: theme.colors.borderSubtle, borderRadius: theme.radius.sm }} />
            </View>
          ) : weather ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <AppText variant="hero" style={{ fontSize: 48, lineHeight: 54 }}>
                  {Math.round(weather.temperatureC)}°
                </AppText>
                <AppText variant="sectionTitle" tone="muted">
                  {weather.locationLabel || 'Current Location'}
                </AppText>
              </View>
              <View 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: spacing.xs,
                  marginTop: spacing.xs,
                }}>
                <View 
                  style={{ 
                    paddingHorizontal: spacing.sm, 
                    paddingVertical: spacing.xs,
                    backgroundColor: theme.colors.accentLight,
                    borderRadius: theme.radius.full,
                  }}>
                  <AppText variant="meta" tone="accent">
                    {weather.season.charAt(0).toUpperCase() + weather.season.slice(1)}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">{weather.summary}</AppText>
              </View>
              <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.sm }}>
                {weather.stylingHint}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {errorMessage ?? 'Weather unavailable. Outfits will be based on your profile and anchor items.'}
            </AppText>
          )}
        </View>
        {weather && !isLoading && (
          <View 
            style={{ 
              width: 56, 
              height: 56, 
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons 
              name={getWeatherIcon(weather.summary)} 
              size={28} 
              color={theme.colors.accent} 
            />
          </View>
        )}
      </View>
    </View>
  );
}
