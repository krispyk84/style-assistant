import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { LookTierDefinition } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';

type TierCardProps = {
  tier: LookTierDefinition;
  expanded?: boolean;
};

const tierIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  business: 'briefcase-outline',
  'smart-casual': 'shirt-outline',
  casual: 'cafe-outline',
};

export function TierCard({ tier, expanded = false }: TierCardProps) {
  const icon = tierIcons[tier.slug] || 'sparkles-outline';
  
  return (
    <Link href={`/tier/${tier.slug}` as const} asChild>
      <Pressable
        style={({ pressed }) => [
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
            opacity: pressed ? 0.95 : 1,
          },
          theme.shadows.md,
        ]}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="accent">Look Tier</AppText>
            <AppText variant="title">{tier.label}</AppText>
            <AppText variant="caption" tone="muted">{tier.shortDescription}</AppText>
          </View>
          <View 
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={icon} size={24} color={theme.colors.accent} />
          </View>
        </View>
        
        {/* Benefits */}
        <View style={{ gap: spacing.xs }}>
          {tier.bestFor.map((benefit) => (
            <View key={benefit} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View 
                style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.accent,
                }} 
              />
              <AppText variant="caption" tone="muted">{benefit}</AppText>
            </View>
          ))}
        </View>
        
        {/* Expanded Palette */}
        {expanded && (
          <View 
            style={{ 
              padding: spacing.md, 
              backgroundColor: theme.colors.accentLight,
              borderRadius: theme.radius.md,
              gap: spacing.xs,
            }}>
            <AppText variant="meta" tone="accent">Palette Cues</AppText>
            <AppText variant="caption" tone="muted">{tier.palette.join(' • ')}</AppText>
          </View>
        )}
        
        {/* Arrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <View 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: spacing.xs,
            }}>
            <AppText variant="meta" tone="accent">View Tier</AppText>
            <Ionicons name="arrow-forward" size={14} color={theme.colors.accent} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
