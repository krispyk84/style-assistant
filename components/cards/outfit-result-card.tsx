import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTierHref } from '@/lib/look-route';
import { formatTierLabel } from '@/lib/outfit-utils';
import { buildSavedOutfitPreview, formatSavedPreviewDate } from '@/lib/saved-style-preview';
import type { SavedOutfit } from '@/types/style';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel, SKETCH_ASPECT_RATIO } from '@/components/ui/remote-image-panel';

type OutfitResultCardProps = {
  result: SavedOutfit;
  onDelete?: () => void;
  onAddToWeek?: () => void;
  /** Overrides the default "Saved [date]" line — e.g. "Created April 10". */
  dateLabel?: string;
};

export function OutfitResultCard({ result, onDelete, onAddToWeek, dateLabel }: OutfitResultCardProps) {
  const { theme } = useTheme();
  const preview = buildSavedOutfitPreview(result);
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
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <AppText variant="meta">
              {formatTierLabel(result.recommendation.tier)} tier
            </AppText>
            {result.input.weatherContext?.season ? (
              <View style={{
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'capitalize', color: theme.colors.mutedText }}>
                  {result.input.weatherContext.season}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText tone="subtle">{dateLabel ?? `Saved ${formatSavedPreviewDate(preview.savedAt)}`}</AppText>
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
            <AppIcon color={theme.colors.danger} name="trash" size={20} />
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
            aspectRatio={SKETCH_ASPECT_RATIO}
            minHeight={400}
            resizeMode="contain"
            fallbackTitle="Sketch unavailable"
            fallbackMessage="The saved illustration could not be displayed."
          />
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <AppText style={{ flexShrink: 1, width: '100%' }} variant="title">
            {preview.title}
          </AppText>
          <AppText numberOfLines={1} tone="muted">
            {preview.subtitle}
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
          <AppIcon color={theme.colors.text} name="calendar" size={18} />
          <AppText>Add to week</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
