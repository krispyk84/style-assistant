import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { SavedTripSummary } from '@/services/saved-trips';

type Props = {
  trip: SavedTripSummary;
  onPress: () => void;
  onDelete: () => void;
};

function formatDateRange(departure: string, returnDate: string): string {
  try {
    const dep = new Date(departure + 'T00:00:00');
    const ret = new Date(returnDate + 'T00:00:00');
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(dep)} – ${fmt(ret)}`;
  } catch {
    return `${departure} – ${returnDate}`;
  }
}

export function SavedTripCard({ trip, onPress, onDelete }: Props) {
  const { theme } = useTheme();

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
            <AppText variant="sectionTitle" style={{ fontSize: 17 }}>{trip.destination}</AppText>
            <AppText tone="muted" style={{ fontSize: 13 }}>
              {formatDateRange(trip.departureDate, trip.returnDate)}
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
