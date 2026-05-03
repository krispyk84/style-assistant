import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ClosetItemSheet } from '@/components/closet/closet-item-sheet';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import {
  TRIP_OUTFIT_GROUP_LABELS,
  TRIP_OUTFIT_GROUP_ORDER,
  type LabeledPiece,
  type TripItemCategory,
} from '@/lib/outfit-piece-display';

// ── Props ─────────────────────────────────────────────────────────────────────

export type OutfitPieceListViewProps = {
  pieces: LabeledPiece[];
  display: 'labeled' | 'grouped' | 'card';
  /** Group iteration order for `display='grouped'`. */
  groupOrder?: readonly TripItemCategory[];
  /** Group display labels for `display='grouped'`. */
  groupLabels?: Record<TripItemCategory, string>;
  /** Suggestions currently being rematched — shows a loading indicator on that piece row. */
  regeneratingMatches?: Set<string>;
  /** Persisted per-suggestion feedback. Drives the thumbs UI when the sheet opens. */
  matchFeedbackMap?: Record<string, 'up' | 'down' | null>;
  /** Optional thumbs handlers. When omitted, the sheet renders view-only. */
  onMatchThumbsUp?: (suggestion: string, matchedItemId: string) => void;
  onMatchThumbsDown?: (suggestion: string, matchedItemId: string) => void;
  /** For `display='card'`: whole-row press handler (e.g. navigate to a check-piece flow). */
  onPieceSelect?: (piece: LabeledPiece) => void;
  /** For `display='card'`: optional decorative icon at the row's trailing edge. */
  trailingIcon?: AppIconName;
};

type SelectedMatch = { suggestion: string; confidencePercent: number };

// ── View ──────────────────────────────────────────────────────────────────────

export function OutfitPieceListView({
  pieces,
  display,
  groupOrder = TRIP_OUTFIT_GROUP_ORDER,
  groupLabels = TRIP_OUTFIT_GROUP_LABELS,
  regeneratingMatches,
  matchFeedbackMap,
  onMatchThumbsUp,
  onMatchThumbsDown,
  onPieceSelect,
  trailingIcon,
}: OutfitPieceListViewProps) {
  const [selected, setSelected] = useState<SelectedMatch | null>(null);

  // Derive the current matched item live from `pieces` so the sheet auto-updates after rematch.
  const currentItem = selected
    ? pieces.find((p) => p.value === selected.suggestion)?.matchedClosetItem ?? null
    : null;
  const isRematching = selected ? regeneratingMatches?.has(selected.suggestion) ?? false : false;

  function openSheet(suggestion: string, confidencePercent: number) {
    setSelected({ suggestion, confidencePercent });
  }

  return (
    <>
      {display === 'labeled' ? (
        <LabeledList pieces={pieces} regeneratingMatches={regeneratingMatches} onPiecePress={openSheet} />
      ) : display === 'grouped' ? (
        <GroupedList
          pieces={pieces}
          groupOrder={groupOrder}
          groupLabels={groupLabels}
          regeneratingMatches={regeneratingMatches}
          onPiecePress={openSheet}
        />
      ) : (
        <CardList
          pieces={pieces}
          regeneratingMatches={regeneratingMatches}
          onPiecePress={openSheet}
          onPieceSelect={onPieceSelect}
          trailingIcon={trailingIcon}
        />
      )}

      {selected ? (
        <ClosetItemSheet
          item={currentItem}
          suggestion={selected.suggestion}
          isRematching={isRematching}
          thumbsFeedback={matchFeedbackMap?.[selected.suggestion] ?? null}
          confidencePercent={selected.confidencePercent}
          onThumbsUp={
            onMatchThumbsUp && currentItem
              ? () => onMatchThumbsUp(selected.suggestion, currentItem.id)
              : undefined
          }
          onThumbsDown={
            onMatchThumbsDown && currentItem
              ? () => onMatchThumbsDown(selected.suggestion, currentItem.id)
              : undefined
          }
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

// ── Shared "you already own" hint ─────────────────────────────────────────────

function OwnedHint({ visible }: { visible: boolean }) {
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <View
      style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs }}>
      <AppIcon color={theme.colors.accent} name="check-circle" size={13} />
      <AppText tone="muted" style={{ fontSize: 12 }}>
        You already own a similar piece
      </AppText>
    </View>
  );
}

// ── Labeled mode ──────────────────────────────────────────────────────────────

type ListChildProps = {
  pieces: LabeledPiece[];
  regeneratingMatches?: Set<string>;
  onPiecePress: (suggestion: string, confidencePercent: number) => void;
};

function LabeledList({ pieces, regeneratingMatches, onPiecePress }: ListChildProps) {
  const { theme } = useTheme();
  const hasAnyMatch = pieces.some((p) => !p.isAnchor && p.matchedClosetItem !== null);

  return (
    <View style={{ gap: spacing.sm }}>
      <OwnedHint visible={hasAnyMatch} />

      {pieces.map((piece) => {
        const isRematching = (!piece.isAnchor && regeneratingMatches?.has(piece.value)) ?? false;
        return (
          <View
            key={`${piece.label}-${piece.value}`}
            style={{
              alignItems: 'flex-start',
              borderBottomColor: theme.colors.border,
              borderBottomWidth: 1,
              flexDirection: 'row',
              gap: spacing.xs,
              paddingBottom: spacing.sm,
            }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="sectionTitle">{piece.label}</AppText>
              <AppText tone="muted">{piece.value}</AppText>
            </View>
            {!piece.isAnchor && isRematching ? (
              <ActivityIndicator color={theme.colors.accent} size="small" style={{ paddingTop: 2 }} />
            ) : !piece.isAnchor && piece.matchedClosetItem ? (
              <Pressable
                accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view and rate.`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onPiecePress(piece.value, piece.confidencePercent)}
                style={{ paddingTop: 2 }}>
                <AppIcon color={theme.colors.accent} name="check-circle" size={22} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Grouped mode ──────────────────────────────────────────────────────────────

type GroupedListProps = ListChildProps & {
  groupOrder: readonly TripItemCategory[];
  groupLabels: Record<TripItemCategory, string>;
};

function GroupedList({ pieces, groupOrder, groupLabels, regeneratingMatches, onPiecePress }: GroupedListProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {groupOrder.map((category) => {
        const groupPieces = pieces.filter((p) => p.category === category);
        if (!groupPieces.length) return null;
        return (
          <View key={category}>
            <AppText
              style={{
                color: theme.colors.mutedText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 10,
                letterSpacing: 1.2,
                marginBottom: 4,
                textTransform: 'uppercase',
              }}>
              {groupLabels[category]}
            </AppText>
            {groupPieces.map((piece) => {
              const isRematching = regeneratingMatches?.has(piece.value) ?? false;
              return (
                <View
                  key={piece.value}
                  style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xs }}>
                  <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
                  <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{piece.value}</AppText>
                  {isRematching ? (
                    <ActivityIndicator color={theme.colors.accent} size="small" style={{ marginTop: 3 }} />
                  ) : piece.matchedClosetItem ? (
                    <Pressable
                      accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view.`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => onPiecePress(piece.value, piece.confidencePercent)}
                      style={{ marginTop: 3 }}>
                      <AppIcon color={theme.colors.accent} name="check-circle" size={13} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Card mode ─────────────────────────────────────────────────────────────────

type CardListProps = ListChildProps & {
  onPieceSelect?: (piece: LabeledPiece) => void;
  trailingIcon?: AppIconName;
};

function CardList({ pieces, regeneratingMatches, onPiecePress, onPieceSelect, trailingIcon }: CardListProps) {
  const { theme } = useTheme();
  const hasAnyMatch = pieces.some((p) => !p.isAnchor && p.matchedClosetItem !== null);

  const rowStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as const;

  return (
    <View style={{ gap: spacing.md }}>
      <OwnedHint visible={hasAnyMatch} />

      {pieces.map((piece) => {
        const isRematching = (!piece.isAnchor && regeneratingMatches?.has(piece.value)) ?? false;
        return (
          <Pressable
            key={`${piece.label}-${piece.value}`}
            style={rowStyle}
            onPress={onPieceSelect ? () => onPieceSelect(piece) : undefined}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="sectionTitle">{piece.label}</AppText>
              <AppText tone="muted">{piece.value}</AppText>
            </View>
            {!piece.isAnchor && isRematching ? (
              <ActivityIndicator color={theme.colors.accent} size="small" />
            ) : !piece.isAnchor && piece.matchedClosetItem ? (
              <Pressable
                accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view and rate.`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onPiecePress(piece.value, piece.confidencePercent)}
                style={{ paddingTop: 2 }}>
                <AppIcon color={theme.colors.accent} name="check-circle" size={22} />
              </Pressable>
            ) : null}
            {trailingIcon ? <AppIcon color={theme.colors.text} name={trailingIcon} size={22} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
