import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { AnchorRecommendation, AnchorSlot } from '@/lib/trip-anchor-recommender';
import type { SelectedAnchor } from '@/app/trip-anchors-types';
import { AnchorChip } from './AnchorChip';

type GuidedPanelProps = {
  recommendation: AnchorRecommendation;
  guidedAnchors: Record<string, SelectedAnchor | undefined>;
  extraSlots: AnchorSlot[];
  numDays: number;
  onAddToSlot: (slotId: string) => void;
  onClearSlot: (slotId: string) => void;
  onAddExtraSlot: () => void;
};

export function GuidedPanel({
  recommendation,
  guidedAnchors,
  extraSlots,
  numDays,
  onAddToSlot,
  onClearSlot,
  onAddExtraSlot,
}: GuidedPanelProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {/* Summary card */}
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 16,
        padding: spacing.md,
        gap: spacing.xs,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <AppIcon name="sparkles" color={theme.colors.accent} size={14} />
          <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.mutedText }}>
            {recommendation.summary}
          </AppText>
        </View>
      </View>

      {/* Recommendation slots + extra slots */}
      {[...recommendation.slots, ...extraSlots].map((slot) => {
        const selected = guidedAnchors[slot.id];
        const isExtra = !recommendation.slots.some((s) => s.id === slot.id);
        return (
          <View
            key={slot.id}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              borderRadius: 20,
              borderWidth: 1,
              padding: spacing.lg,
              gap: spacing.sm,
            }}>
            {/* Slot header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{
                backgroundColor: slot.required ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText style={{
                  color: slot.required ? theme.colors.inverseText : theme.colors.mutedText,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}>
                  {isExtra ? 'Extra' : slot.required ? 'Required' : 'Optional'}
                </AppText>
              </View>
              <AppText style={{
                color: theme.colors.mutedText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 10,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                {slot.category}
              </AppText>
            </View>

            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
              {slot.label}
            </AppText>
            <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
              {slot.rationale}
            </AppText>

            {/* Selected item preview */}
            {selected ? (
              <View style={{ gap: spacing.sm }}>
                <AnchorChip anchor={selected} onRemove={() => onClearSlot(slot.id)} />
                <Pressable
                  onPress={() => onAddToSlot(slot.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppIcon name="refresh" color={theme.colors.accent} size={11} />
                  <AppText style={{
                    color: theme.colors.accent,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 12,
                  }}>
                    Replace item
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => onAddToSlot(slot.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 12,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  paddingVertical: spacing.md,
                }}>
                <AppIcon name="add" color={theme.colors.mutedText} size={14} />
                <AppText style={{
                  color: theme.colors.mutedText,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 13,
                }}>
                  Add anchor piece
                </AppText>
              </Pressable>
            )}
          </View>
        );
      })}

      {/* Add extra anchor slot */}
      {recommendation.slots.length + extraSlots.length < numDays + 3 && (
        <Pressable
          onPress={onAddExtraSlot}
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
    </View>
  );
}
