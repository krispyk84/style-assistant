import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { Profile } from '@/types/profile';
import { AppText } from '@/components/ui/app-text';

type ProfileCardProps = {
  profile: Profile;
};

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 32,
        padding: spacing.xl,
        gap: spacing.md,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="eyebrow">Profile Snapshot</AppText>
        <AppText variant="heroSmall">{profile.stylePreference.replaceAll('-', ' ')}</AppText>
        <AppText tone="muted">
          {profile.fitPreference} fit • {profile.budget} budget • {profile.skinTone} skin tone
        </AppText>
      </View>
      <AppText tone="subtle">
        {profile.notes || 'Profile notes are empty. Add context like work setting, climate, or wardrobe gaps.'}
      </AppText>
    </View>
  );
}
