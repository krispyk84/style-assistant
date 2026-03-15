import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { LookTierDefinition } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';

type TierCardProps = {
  tier: LookTierDefinition;
  expanded?: boolean;
};

export function TierCard({ tier, expanded = false }: TierCardProps) {
  return (
    <Link href={`/tier/${tier.slug}` as const} asChild>
      <Pressable
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 28,
          borderWidth: 1,
          padding: spacing.lg,
          gap: spacing.md,
        }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow">Look Tier</AppText>
          <AppText variant="title">{tier.label}</AppText>
          <AppText tone="muted">{tier.shortDescription}</AppText>
        </View>
        {tier.bestFor.map((benefit) => (
          <AppText key={benefit} tone="muted">
            • {benefit}
          </AppText>
        ))}
        {expanded ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Palette cues</AppText>
            <AppText tone="muted">{tier.palette.join(' • ')}</AppText>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}
