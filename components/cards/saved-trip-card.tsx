import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { countryFlag, formatTripDateRange } from '@/lib/saved-style-preview';
import type { SavedTripSummary } from '@/services/saved-trips';

type Props = {
  trip: SavedTripSummary;
  onPress: () => void;
  onDelete: () => void;
};

export function SavedTripCard({ trip, onPress, onDelete }: Props) {
  const { theme } = useTheme();
  const flag = countryFlag(trip.country);

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      {/* Main content */}
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>

        {/* Top row: destination + delete */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 3, paddingRight: spacing.md }}>
            <AppText variant="sectionTitle" style={{ fontSize: 17 }}>
              {flag ? `${flag} ` : ''}{trip.destination}
            </AppText>
            <AppText tone="muted" style={{ fontSize: 13 }}>
              {formatTripDateRange(trip.departureDate, trip.returnDate)}
            </AppText>
          </View>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={{ padding: 4 }}>
            <AppIcon name="trash" color={theme.colors.subtleText} size={16} />
          </Pressable>
        </View>

        {/* Meta pills */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <View style={{
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 999,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}>
            <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
              {trip.travelParty}
            </AppText>
          </View>
          <View style={{
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 999,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}>
            <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
              {trip.dayCount} {trip.dayCount === 1 ? 'day' : 'days'}
            </AppText>
          </View>
          {trip.climateLabel ? (
            <View style={{
              backgroundColor: theme.colors.subtleSurface,
              borderRadius: 999,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}>
              <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
                {trip.climateLabel}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Arrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
          <AppIcon name="arrow-right" color={theme.colors.subtleText} size={14} />
        </View>
      </View>
    </Pressable>
  );
}
