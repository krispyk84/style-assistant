import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTierHref } from '@/lib/look-route';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { SavedOutfit } from '@/types/style';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type OutfitResultCardProps = {
  result: SavedOutfit;
  onDelete?: () => void;
  onAddToWeek?: () => void;
  /** Overrides the default "Saved [date]" line — e.g. "Created April 10". */
  dateLabel?: string;
};

export function OutfitResultCard({ result, onDelete, onAddToWeek, dateLabel }: OutfitResultCardProps) {
  const { theme } = useTheme();
  const sketchUri = result.recommendation.sketchImageUrl;
  const detailHref = buildTierHref(
    result.recommendation.tier,
    result.requestId,
    result.input,
    result.recommendation
  );

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        padding: spacing.lg,
        gap: spacing.md,
      }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="meta">
            {formatTierLabel(result.recommendation.tier)} tier
          </AppText>
          <AppText tone="subtle">{dateLabel ?? `Saved ${formatSavedAt(result.savedAt)}`}</AppText>
        </View>
        {onDelete ? (
          <Pressable
            accessibilityLabel="Delete saved outfit"
            hitSlop={10}
            onPress={onDelete}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 36,
              minWidth: 36,
            }}>
            <Ionicons color={theme.colors.danger} name="trash-outline" size={20} />
          </Pressable>
        ) : null}
      </View>

      <Link href={detailHref} asChild>
        <Pressable
        style={{
          gap: spacing.md,
          width: '100%',
        }}>
        {sketchUri ? (
          <RemoteImagePanel
            uri={sketchUri}
            aspectRatio={1}
            minHeight={220}
            fallbackTitle="Sketch unavailable"
            fallbackMessage="The saved illustration could not be displayed."
          />
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <AppText style={{ flexShrink: 1, width: '100%' }} variant="title">
            {result.recommendation.title}
          </AppText>
          <AppText numberOfLines={1} tone="muted">
            {result.input.anchorItemDescription || result.recommendation.anchorItem}
          </AppText>
        </View>
        </Pressable>
      </Link>
      {onAddToWeek ? (
        <Pressable
          onPress={onAddToWeek}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}>
          <Ionicons color={theme.colors.text} name="calendar-outline" size={18} />
          <AppText>Add to week</AppText>
        </Pressable>
      ) : null}
    </View>
  );
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
