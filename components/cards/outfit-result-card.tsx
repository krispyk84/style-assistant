import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing, theme } from '@/constants/theme';
import { buildTierHref } from '@/lib/look-route';
import type { SavedOutfit } from '@/types/style';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type OutfitResultCardProps = {
  result: SavedOutfit;
  onDelete?: () => void;
  onAddToWeek?: () => void;
};

export function OutfitResultCard({ result, onDelete, onAddToWeek }: OutfitResultCardProps) {
  const sketchUri = result.recommendation.sketchImageUrl;
  const detailHref = buildTierHref(
    result.recommendation.tier,
    result.requestId,
    result.input,
    result.recommendation,
    0
  );

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
      {/* Header */}
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderSubtle,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View 
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="heart" size={16} color={theme.colors.accent} />
          </View>
          <View>
            <AppText variant="meta" tone="accent">
              {formatTierLabel(result.recommendation.tier)}
            </AppText>
            <AppText variant="caption" tone="subtle">Saved {formatSavedAt(result.savedAt)}</AppText>
          </View>
        </View>
        {onDelete && (
          <Pressable
            accessibilityLabel="Delete saved outfit"
            hitSlop={12}
            onPress={onDelete}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: theme.radius.full,
              backgroundColor: pressed ? theme.colors.dangerLight : theme.colors.borderSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            })}>
            <Ionicons color={theme.colors.danger} name="trash-outline" size={18} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      <Link href={detailHref} asChild>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
          {sketchUri && (
            <View style={{ padding: spacing.md }}>
              <RemoteImagePanel
                uri={sketchUri}
                aspectRatio={4 / 5}
                minHeight={200}
                fallbackTitle="Sketch unavailable"
                fallbackMessage="The saved illustration could not be displayed."
              />
            </View>
          )}
          <View style={{ padding: spacing.lg, paddingTop: sketchUri ? 0 : spacing.lg, gap: spacing.xs }}>
            <AppText variant="title">{result.recommendation.title}</AppText>
            <AppText variant="caption" numberOfLines={1} tone="muted">
              {result.input.anchorItemDescription || result.recommendation.anchorItem}
            </AppText>
          </View>
        </Pressable>
      </Link>
      
      {/* Footer Actions */}
      {onAddToWeek && (
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <Pressable
            onPress={onAddToWeek}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              minHeight: 48,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.accentLight,
              opacity: pressed ? 0.8 : 1,
            })}>
            <Ionicons color={theme.colors.accent} name="calendar-outline" size={18} />
            <AppText variant="meta" tone="accent">Add to Week</AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function formatTierLabel(tier: SavedOutfit['recommendation']['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatSavedAt(savedAt: string) {
  try {
    return new Date(savedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'recently';
  }
}
