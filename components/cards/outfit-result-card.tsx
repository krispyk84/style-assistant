import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing, theme } from '@/constants/theme';
import { buildTierHref } from '@/lib/look-route';
import type { SavedOutfit } from '@/types/style';
import { AppText } from '@/components/ui/app-text';

type OutfitResultCardProps = {
  result: SavedOutfit;
  onDelete?: () => void;
};

export function OutfitResultCard({ result, onDelete }: OutfitResultCardProps) {
  const detailHref = buildTierHref(
    result.recommendation.tier,
    result.requestId,
    result.input,
    result.recommendation,
    0
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
          <AppText tone="subtle">Saved {formatSavedAt(result.savedAt)}</AppText>
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
        }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title">{result.recommendation.title}</AppText>
          <AppText tone="muted">{result.input.anchorItemDescription || result.recommendation.anchorItem}</AppText>
        </View>

        <View style={{ gap: spacing.xs }}>
          {buildSummaryPieces(result.recommendation).map((piece) => (
            <AppText key={`${piece.label}-${piece.value}`} tone="muted">
              • {piece.label} · {piece.value}
            </AppText>
          ))}
        </View>
        </Pressable>
      </Link>
    </View>
  );
}

function buildSummaryPieces(recommendation: SavedOutfit['recommendation']) {
  return [
    ...recommendation.keyPieces.map((piece, index) => ({
      label: index === 0 ? 'Key piece' : `Piece ${index + 1}`,
      value: piece,
    })),
    ...recommendation.shoes.map((piece, index) => ({
      label: index === 0 ? 'Shoes' : `Shoe ${index + 1}`,
      value: piece,
    })),
  ].slice(0, 4);
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
