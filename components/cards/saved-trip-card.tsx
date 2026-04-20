import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { SavedTripSummary } from '@/services/saved-trips';

// ── Country → flag emoji ──────────────────────────────────────────────────────

const COUNTRY_CODES: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
  'Australia': 'AU', 'Austria': 'AT', 'Belgium': 'BE', 'Brazil': 'BR',
  'Canada': 'CA', 'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO',
  'Croatia': 'HR', 'Czech Republic': 'CZ', 'Denmark': 'DK', 'Egypt': 'EG',
  'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'Greece': 'GR',
  'Hong Kong': 'HK', 'Hungary': 'HU', 'Iceland': 'IS', 'India': 'IN',
  'Indonesia': 'ID', 'Iran': 'IR', 'Ireland': 'IE', 'Israel': 'IL',
  'Italy': 'IT', 'Japan': 'JP', 'Jordan': 'JO', 'Kenya': 'KE',
  'Malaysia': 'MY', 'Maldives': 'MV', 'Mexico': 'MX', 'Morocco': 'MA',
  'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG', 'Norway': 'NO',
  'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT',
  'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA', 'Singapore': 'SG',
  'South Africa': 'ZA', 'South Korea': 'KR', 'Spain': 'ES', 'Sweden': 'SE',
  'Switzerland': 'CH', 'Taiwan': 'TW', 'Thailand': 'TH', 'Turkey': 'TR',
  'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', 'Vietnam': 'VN',
};

function countryFlag(countryName: string): string {
  const code = COUNTRY_CODES[countryName];
  if (!code) return '';
  const A = 0x1F1E6 - 65;
  return String.fromCodePoint(A + code.charCodeAt(0), A + code.charCodeAt(1));
}

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
