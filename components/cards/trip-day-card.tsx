import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTripDayLabeledPieces } from '@/lib/outfit-piece-display';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';
import { OutfitItemThumbnailRow } from './OutfitItemThumbnailRow';
import { OutfitPieceListView } from './OutfitPieceListView';

const MAX_SWAP_SELECTION = 2;

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Day type badge ────────────────────────────────────────────────────────────

const DAY_TYPE_LABELS: Record<TripOutfitDay['dayType'], string> = {
  travel_day:    'Travel',
  sightseeing:   'Sightseeing',
  business:      'Business',
  meeting:       'Meeting',
  dinner_out:    'Dinner',
  beach_pool:    'Beach / Pool',
  adventure:     'Adventure',
  wedding_event: 'Event',
  relaxed:       'Relaxed',
  conference:    'Conference',
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  day: TripOutfitDay;
  closetItems?: ClosetItem[];
  isRegenerating: boolean;
  onGenerateSketch: () => void;
  onLove: () => void;
  onHate: () => void;
  /** fullCloset days only — tapping a piece becomes a swap selection (max 2) and a "Generate Variants" button appears. */
  onGenerateVariants?: (day: TripOutfitDay, swapItemIds: string[]) => void;
};

export function TripDayCard({ day, closetItems, isRegenerating, onGenerateSketch, onLove, onHate, onGenerateVariants }: Props) {
  const { theme } = useTheme();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  function toggleItemSelected(itemId: string) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= MAX_SWAP_SELECTION) return current;
      return [...current, itemId];
    });
  }

  const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const hasSketch = day.sketchStatus === 'ready' && !!day.sketchUrl;

  const isLoved = day.feedback === 'love';
  const isHated = day.feedback === 'hate';

  const labeledPieces = useMemo(
    () => buildTripDayLabeledPieces(day, closetItems),
    [day, closetItems],
  );

  // fullCloset days are resolved to real owned items (see Phase 1's
  // resolveClosetConstrainedPieces) — show them as tappable photo thumbnails,
  // matching the closet-outfit-card visual language. Anchor-based days keep
  // the grouped text list since their pieces aren't guaranteed real items.
  const isFullClosetDay = !!day.closetItemIds?.length;
  const thumbnailItems = useMemo(
    () =>
      labeledPieces
        .filter((piece) => piece.matchedClosetItem)
        .map((piece) => ({
          id: piece.matchedClosetItem!.id,
          title: piece.matchedClosetItem!.title,
          imageUrl: piece.matchedClosetItem!.sketchImageUrl ?? piece.matchedClosetItem!.uploadedImageUrl,
        })),
    [labeledPieces],
  );

  // Animate layout when sketch becomes ready so the card expands smoothly.
  const prevHasSketch = useRef(hasSketch);
  useEffect(() => {
    if (!prevHasSketch.current && hasSketch) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(320, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
      );
    }
    prevHasSketch.current = hasSketch;
  }, [hasSketch]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      <GeneratedSketchPanel
        mode="compact"
        status={day.sketchStatus}
        imageUrl={day.sketchUrl}
        aspectRatio={1024 / 1536}
        resizeMode="cover"
        isRegenerating={isRegenerating}
        onAction={onGenerateSketch}
        loadingLabel="Generating sketch..."
        regeneratingLabel="Finding a new outfit..."
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md, padding: spacing.lg }}>

        {/* Day header */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {dayLabel}
            </AppText>
            <View
              style={{
                backgroundColor: theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}>
              <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
                {DAY_TYPE_LABELS[day.dayType] ?? day.dayType}
              </AppText>
            </View>
          </View>
          <AppText variant="sectionTitle">{day.title}</AppText>
          <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{day.rationale}</AppText>
        </View>

        {/* Outfit pieces */}
        {isFullClosetDay ? (
          <View style={{ gap: spacing.xs }}>
            <OutfitItemThumbnailRow
              items={thumbnailItems}
              selectedItemIds={onGenerateVariants ? selectedItemIds : undefined}
              onToggleSelect={onGenerateVariants ? toggleItemSelected : undefined}
            />
            {onGenerateVariants ? (
              <>
                <AppText tone="subtle" style={{ fontSize: 12 }}>
                  {selectedItemIds.length === 0
                    ? 'Tap 1-2 pieces above to swap — everything else stays the same.'
                    : `Swapping ${selectedItemIds.length} piece${selectedItemIds.length === 1 ? '' : 's'} — the rest of this outfit stays the same.`}
                </AppText>
                {selectedItemIds.length > 0 ? (
                  <PrimaryButton
                    label="Generate Variants"
                    variant="secondary"
                    onPress={() => onGenerateVariants(day, selectedItemIds)}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ) : (
          <OutfitPieceListView pieces={labeledPieces} display="grouped" />
        )}

        {/* Context tags */}
        {(day.contextTags ?? []).length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {day.contextTags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 999,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}>
                <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>{tag}</AppText>
              </View>
            ))}
          </View>
        )}

        {/* ── Actions row ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>

          {/* Love / Hate */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={onLove}
              disabled={isRegenerating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isLoved ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 1,
              }}>
              <AppIcon
                name="heart"
                color={isLoved ? theme.colors.inverseText : theme.colors.subtleText}
                size={13}
              />
              <AppText style={{
                color: isLoved ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 12,
              }}>
                Love it
              </AppText>
            </Pressable>

            <Pressable
              onPress={onHate}
              disabled={isRegenerating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isHated ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 1,
              }}>
              <AppIcon
                name="thumbs-down"
                color={isHated ? theme.colors.inverseText : theme.colors.subtleText}
                size={13}
              />
              <AppText style={{
                color: isHated ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 12,
              }}>
                Hate it
              </AppText>
            </Pressable>
          </View>

          {/* Sketch actions */}
          {hasSketch ? (
            <Pressable
              onPress={onGenerateSketch}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppIcon name="sparkles" color={theme.colors.accent} size={11} />
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 0.4 }}>
                Redo sketch
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
