import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetItem } from '@/types/closet';
import type { LabeledPiece } from './look-result-card-helpers';

export type TierPieceListViewProps = {
  labeledPieces: LabeledPiece[];
  hasAnyMatch: boolean;
  regeneratingMatches?: Set<string>;
  onPiecePress: (item: ClosetItem, suggestion: string, confidencePercent: number) => void;
};

export function TierPieceListView({
  labeledPieces,
  hasAnyMatch,
  regeneratingMatches,
  onPiecePress,
}: TierPieceListViewProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {hasAnyMatch ? (
        <View
          style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs }}>
          <AppIcon color={theme.colors.accent} name="check-circle" size={13} />
          <AppText tone="muted" style={{ fontSize: 12 }}>
            You already own a similar piece
          </AppText>
        </View>
      ) : null}

      {labeledPieces.map((piece) => {
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
                onPress={() => onPiecePress(piece.matchedClosetItem!, piece.value, piece.confidencePercent)}
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
