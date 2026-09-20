import { Image } from 'expo-image';
import { View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { FragranceRecommendationDto } from '@/types/fragrance';

export type FragranceRecommendationCardProps = {
  recommendation: FragranceRecommendationDto;
};

/**
 * Shared, compact fragrance-pairing card reused across every outfit-result
 * surface (Create Look / Ask a Stylist, Trip results, Generate 5 Outfits).
 * Callers render this ONLY when their own recommendation's
 * fragranceRecommendation is non-null — this component never fetches or
 * decides eligibility itself, it only displays what it's given.
 */
export function FragranceRecommendationCard({ recommendation }: FragranceRecommendationCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.subtleSurface,
        borderColor: theme.colors.border,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.sm,
      }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderRadius: 10,
          height: 44,
          justifyContent: 'center',
          overflow: 'hidden',
          width: 44,
        }}>
        {recommendation.bottleSketchUrl ? (
          <Image contentFit="cover" source={{ uri: recommendation.bottleSketchUrl }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <AppIcon color={theme.colors.subtleText} name="tag" size={16} />
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, fontSize: 10, letterSpacing: 1.4 }}>
          Suggested Fragrance
        </AppText>
        <AppText numberOfLines={1} style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
          {recommendation.brand} — {recommendation.name}
        </AppText>
        <AppText numberOfLines={2} tone="muted" style={{ fontSize: 11 }}>
          {recommendation.reason}
        </AppText>
      </View>
    </View>
  );
}
