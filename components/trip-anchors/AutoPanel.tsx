import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { SelectedAnchor } from '@/app/trip-anchors-types';

type AutoPanelProps = {
  loadState: 'loading' | 'ready' | 'empty';
  anchors: SelectedAnchor[];
  numDays: number;
  onRetry: (anchor: SelectedAnchor) => void;
  onReplace: (anchor: SelectedAnchor) => void;
  onAddAnchor: () => void;
};

export function AutoPanel({
  loadState,
  anchors,
  numDays,
  onRetry,
  onReplace,
  onAddAnchor,
}: AutoPanelProps) {
  const { theme } = useTheme();

  if (loadState === 'loading') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
        <ActivityIndicator color={theme.colors.accent} />
        <AppText style={{ color: theme.colors.mutedText, fontSize: 13 }}>
          Selecting anchors from your closet…
        </AppText>
      </View>
    );
  }

  if (loadState === 'empty' || anchors.length === 0) {
    return (
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.sm,
        alignItems: 'center',
      }}>
        <AppIcon name="closet" color={theme.colors.subtleText} size={24} />
        <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' }}>
          No closet items available yet. Switch to Guided or Manual mode to pick anchors manually.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 14,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
      }}>
        <AppIcon name="sparkles" color={theme.colors.accent} size={13} />
        <AppText style={{ flex: 1, color: theme.colors.mutedText, fontSize: 12, lineHeight: 18 }}>
          We will build your outfits around these core pieces. Use Try something else to swap any anchor.
        </AppText>
      </View>

      {anchors.map((anchor) => {
        const imageUri = anchor.source !== 'ai_suggested'
          ? (anchor.closetItemImageUrl ?? anchor.localImageUri ?? anchor.imageUrl)
          : undefined;
        const hasAlts = (anchor.alternates?.length ?? 0) > 0;
        return (
          <View
            key={anchor.id}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 20,
              borderWidth: 1,
              overflow: 'hidden',
            }}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', aspectRatio: 3 / 4 }}
                resizeMode="cover"
              />
            )}
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 999,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}>
                  <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {anchor.category}
                  </AppText>
                </View>
              </View>
              {/* Slot guidance — what Vesture was looking for */}
              {anchor.slotLabel && (
                <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
                  Looking for: {anchor.slotLabel}
                </AppText>
              )}
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                {anchor.source === 'ai_suggested' ? anchor.label : anchor.closetItemTitle ?? anchor.label}
              </AppText>
              {anchor.rationale && (
                <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
                  {anchor.rationale}
                </AppText>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <Pressable
                  onPress={() => hasAlts ? onRetry(anchor) : undefined}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    backgroundColor: theme.colors.subtleSurface,
                    borderColor: hasAlts ? theme.colors.accent : theme.colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity: hasAlts ? 1 : 0.4,
                  }}>
                  <AppIcon name="refresh" color={hasAlts ? theme.colors.accent : theme.colors.subtleText} size={12} />
                  <AppText style={{
                    color: hasAlts ? theme.colors.accent : theme.colors.subtleText,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 12,
                  }}>
                    {hasAlts ? 'Try something else' : 'Only match'}
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => onReplace(anchor)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    backgroundColor: theme.colors.subtleSurface,
                    borderColor: theme.colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                  }}>
                  <AppIcon name="swap" color={theme.colors.text} size={12} />
                  <AppText style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 12,
                  }}>
                    Replace manually
                  </AppText>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      {/* Add extra anchor piece */}
      {anchors.length < numDays + 3 && (
        <Pressable
          onPress={onAddAnchor}
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
