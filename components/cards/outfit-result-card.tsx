import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { OutfitResult } from '@/types/style';
import { AppText } from '@/components/ui/app-text';

type OutfitResultCardProps = {
  result: OutfitResult;
  showDetails?: boolean;
};

export function OutfitResultCard({ result, showDetails = false }: OutfitResultCardProps) {
  return (
    <Link href={`/results/${result.requestId}` as const} asChild>
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
          <AppText variant="meta">{result.tierLabel} tier</AppText>
          <AppText variant="title">{result.title}</AppText>
          <AppText tone="muted">{result.summary}</AppText>
        </View>

        <View style={{ gap: spacing.xs }}>
          {result.pieces.map((piece) => (
            <AppText key={piece.name} tone="muted">
              • {piece.name} · {piece.note}
            </AppText>
          ))}
        </View>

        {showDetails ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Occasion</AppText>
            <AppText tone="muted">{result.occasion}</AppText>
            <AppText variant="sectionTitle">Confidence</AppText>
            <AppText tone="muted">{result.confidence}</AppText>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}
