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

  const quietButtonStyle = { alignItems: 'center', backgroundColor: theme.colors.subtleSurface, borderRadius: 999, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 46, paddingHorizontal: spacing.md } as const;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.accent }}>
              {formatTierLabel(result.recommendation.tier)}
              {result.input.weatherContext?.season ? ` · ${result.input.weatherContext.season}` : ''}
            </AppText>
          </View>
          <AppText tone="subtle" style={{ fontSize: 12 }}>{dateLabel ?? `Saved ${formatSavedPreviewDate(preview.savedAt)}`}</AppText>
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
        <Pressable style={{ gap: spacing.md, width: '100%' }}>
          {sketchUri ? (
            <RemoteImagePanel
              uri={sketchUri}
              aspectRatio={SKETCH_ASPECT_RATIO}
              minHeight={400}
              resizeMode="contain"
              borderRadius={0}
              fallbackTitle="Sketch unavailable"
              fallbackMessage="The saved illustration could not be displayed."
            />
          ) : null}
          <View style={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}>
            <AppText style={{ flexShrink: 1, width: '100%' }} variant="display">
              {preview.title}
            </AppText>
            <AppText numberOfLines={1} tone="muted">
              {preview.subtitle}
            </AppText>
          </View>
        </Pressable>
      </Link>
      {onAddToWeek ? (
        <View style={{ padding: spacing.lg, paddingTop: spacing.md }}>
          <Pressable onPress={onAddToWeek} style={quietButtonStyle}>
            <AppIcon color={theme.colors.text} name="calendar" size={16} />
            <AppText style={{ fontSize: 13 }}>Add to week</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
