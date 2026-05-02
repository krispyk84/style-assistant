import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { AnchorCategory, AnchorRecommendation } from '@/lib/trip-anchor-recommender';
import type { SelectedAnchor } from '@/app/trip-anchors-types';
import { AnchorChip } from './AnchorChip';

type ManualPanelProps = {
  anchors: SelectedAnchor[];
  recommendation: AnchorRecommendation;
  numDays: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

const HINT_CATEGORIES: AnchorCategory[] = ['top', 'bottom', 'shoes', 'outerwear', 'bag'];

export function ManualPanel({ anchors, recommendation, numDays, onAdd, onRemove }: ManualPanelProps) {
  const { theme } = useTheme();
  const cap = numDays + 3;
  const atCap = anchors.length >= cap;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Guidance bar */}
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 14,
        padding: spacing.md,
        gap: spacing.xs,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppIcon name="sparkles" color={theme.colors.accent} size={13} />
          <AppText style={{ flex: 1, fontFamily: theme.fonts.sansMedium, fontSize: 12, color: theme.colors.mutedText }}>
            Recommended for this trip: {recommendation.minCount}–{recommendation.maxCount} anchors
          </AppText>
        </View>
        <AppText style={{ color: theme.colors.subtleText, fontSize: 11, marginLeft: spacing.lg + spacing.sm }}>
          Up to {cap} anchors for a {numDays}-day trip.
        </AppText>
      </View>

      {/* Hint chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {HINT_CATEGORIES.map((cat) => {
          const hasCat = anchors.some((a) => a.category === cat);
          return (
            <View
              key={cat}
              style={{
                backgroundColor: hasCat ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}>
              <AppText style={{
                color: hasCat ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 11,
              }}>
                {hasCat ? '✓ ' : ''}{cat}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Selected anchors */}
      {anchors.map((anchor) => (
        <AnchorChip key={anchor.id} anchor={anchor} onRemove={() => onRemove(anchor.id)} />
      ))}

      {/* Add button */}
      {!atCap && (
        <Pressable
          onPress={onAdd}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 14,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderStyle: 'dashed',
            paddingVertical: spacing.md,
          }}>
          <AppIcon name="add" color={theme.colors.mutedText} size={14} />
          <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
            Add anchor piece
          </AppText>
        </Pressable>
      )}

      {atCap && (
        <AppText style={{ color: theme.colors.accent, fontSize: 12, textAlign: 'center' }}>
          You have reached the maximum number of anchors for this trip.
        </AppText>
      )}
    </View>
  );
}
