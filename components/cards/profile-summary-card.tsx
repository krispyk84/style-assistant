import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { Profile } from '@/types/profile';
import { AppText } from '@/components/ui/app-text';

type ProfileSummaryCardProps = {
  profile: Profile;
};

type ProfileRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const getRows = (profile: Profile): ProfileRow[] => [
  { icon: 'person-outline', label: 'Gender', value: profile.gender },
  { icon: 'resize-outline', label: 'Height', value: `${profile.heightCm} cm` },
  { icon: 'scale-outline', label: 'Weight', value: `${profile.weightKg} kg` },
  { icon: 'shirt-outline', label: 'Fit', value: profile.fitPreference },
  { icon: 'sparkles-outline', label: 'Style', value: profile.stylePreference },
  { icon: 'wallet-outline', label: 'Budget', value: profile.budget },
  { icon: 'color-palette-outline', label: 'Hair', value: profile.hairColor },
  { icon: 'sunny-outline', label: 'Skin tone', value: profile.skinTone },
];

export function ProfileSummaryCard({ profile }: ProfileSummaryCardProps) {
  const rows = getRows(profile);
  
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
        },
        theme.shadows.md,
      ]}>
      {/* Stats Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {rows.slice(0, 4).map((row, index) => (
          <View 
            key={row.label} 
            style={{ 
              width: '50%',
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderRightWidth: index % 2 === 0 ? 1 : 0,
              borderColor: theme.colors.borderSubtle,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Ionicons name={row.icon} size={14} color={theme.colors.subtleText} />
              <AppText variant="meta" tone="subtle">{row.label}</AppText>
            </View>
            <AppText variant="sectionTitle" style={{ textTransform: 'capitalize' }}>
              {row.value.replaceAll('-', ' ')}
            </AppText>
          </View>
        ))}
      </View>
      
      {/* Preferences List */}
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <AppText variant="eyebrow" tone="subtle">Preferences</AppText>
        {rows.slice(4).map((row) => (
          <View 
            key={row.label} 
            style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingVertical: spacing.xs,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View 
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.accentLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={row.icon} size={16} color={theme.colors.accent} />
              </View>
              <AppText variant="caption" tone="muted">{row.label}</AppText>
            </View>
            <AppText variant="sectionTitle" style={{ textTransform: 'capitalize' }}>
              {row.value.replaceAll('-', ' ')}
            </AppText>
          </View>
        ))}
      </View>
      
      {/* Notes Section */}
      {profile.notes && (
        <View 
          style={{ 
            padding: spacing.lg, 
            backgroundColor: theme.colors.accentLight,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderSubtle,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <Ionicons name="document-text-outline" size={14} color={theme.colors.accent} />
            <AppText variant="meta" tone="accent">Notes</AppText>
          </View>
          <AppText variant="caption" tone="muted">{profile.notes}</AppText>
        </View>
      )}
    </View>
  );
}
