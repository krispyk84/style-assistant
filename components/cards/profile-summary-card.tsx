import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { Profile } from '@/types/profile';
import { AppText } from '@/components/ui/app-text';

type ProfileSummaryCardProps = {
  profile: Profile;
};

const rows = (profile: Profile) => [
  { label: 'Gender', value: profile.gender },
  { label: 'Height', value: `${profile.heightCm} cm` },
  { label: 'Weight', value: `${profile.weightKg} kg` },
  { label: 'Fit', value: profile.fitPreference },
  { label: 'Style', value: profile.stylePreference },
  { label: 'Budget', value: profile.budget },
  { label: 'Hair', value: profile.hairColor },
  { label: 'Skin tone', value: profile.skinTone },
];

export function ProfileSummaryCard({ profile }: ProfileSummaryCardProps) {
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
      {rows(profile).map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <AppText tone="muted">{row.label}</AppText>
          <AppText style={{ flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' }}>
            {row.value.replaceAll('-', ' ')}
          </AppText>
        </View>
      ))}
      {profile.notes ? (
        <View style={{ gap: spacing.xs }}>
          <AppText tone="muted">Notes</AppText>
          <AppText>{profile.notes}</AppText>
        </View>
      ) : null}
    </View>
  );
}
