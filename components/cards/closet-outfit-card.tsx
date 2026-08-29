import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import type { ClosetGeneratedOutfit } from '@/types/api';

const MAX_SWAP_SELECTION = 2;

type ClosetOutfitCardProps = {
  outfit: ClosetGeneratedOutfit;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  onAddToWeek?: () => void;
  onDelete?: () => void;
  onFeedback?: (value: 'love' | 'hate') => void;
  /** When set, item thumbnails become selectable (up to 2) and a "Generate Variants" button appears above Save/Add to week. */
  onGenerateVariants?: (selectedItemIds: string[]) => void;
  onSecondOpinion?: () => void;
};

export function ClosetOutfitCard({
  outfit,
  onSave,
  isSaved = false,
  isSaving = false,
  onAddToWeek,
  onDelete,
  onFeedback,
  onGenerateVariants,
  onSecondOpinion,
}: ClosetOutfitCardProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const showActions = onSave || onAddToWeek || onDelete;

  function toggleItemSelected(itemId: string) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= MAX_SWAP_SELECTION) return current;
      return [...current, itemId];
    });
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <AppText variant="sectionTitle">{outfit.title}</AppText>

      <AppText tone="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>{outfit.whyItWorks}</AppText>

      <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden' }}>
        <GeneratedSketchPanel
          mode="compact"
          status={outfit.sketchStatus}
          imageUrl={outfit.sketchImageUrl}
          pendingTitle="Sketching this outfit..."
          pendingMessage="The illustration will appear automatically when it's ready."
          failedLabel="Sketch unavailable"
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {outfit.items.map((item) => {
          const imageUri = item.sketchImageUrl ?? item.uploadedImageUrl;
          const isSelected = selectedItemIds.includes(item.id);
          const thumbnail = (
            <>
              <View
                style={{
                  backgroundColor: theme.colors.card,
                  borderColor: isSelected ? theme.colors.accent : 'transparent',
                  borderRadius: 12,
                  borderWidth: 2,
                  height: 72,
                  overflow: 'hidden',
                  width: 72,
                }}>
                {imageUri ? (
                  <Image contentFit="cover" source={{ uri: imageUri }} style={{ height: '100%', width: '100%' }} />
                ) : (
                  <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                    <AppIcon color={theme.colors.subtleText} name="closet" size={20} />
                  </View>
                )}
                {isSelected ? (
                  <View
                    style={{
                      alignItems: 'center',
                      backgroundColor: theme.colors.accent,
                      borderRadius: 999,
                      height: 20,
                      justifyContent: 'center',
                      position: 'absolute',
                      right: 4,
                      top: 4,
                      width: 20,
                    }}>
                    <AppIcon color={theme.colors.inverseText} name="check-circle" size={14} />
                  </View>
                ) : null}
              </View>
              <AppText tone="subtle" numberOfLines={1} style={{ fontSize: 10, marginTop: 2, textAlign: 'center', width: 72 }}>
                {item.title}
              </AppText>
            </>
          );

          if (!onGenerateVariants) {
            return (
              <View key={item.id} style={{ alignItems: 'center', width: 72 }}>
                {thumbnail}
              </View>
            );
          }

          return (
            <Pressable key={item.id} onPress={() => toggleItemSelected(item.id)} style={{ alignItems: 'center', width: 72 }}>
              {thumbnail}
            </Pressable>
          );
        })}
      </View>

      {onGenerateVariants ? (
        <View style={{ gap: spacing.xs }}>
          <AppText tone="subtle" style={{ fontSize: 12 }}>
            {selectedItemIds.length === 0
              ? 'Tap 1-2 pieces above to swap — everything else stays the same.'
              : `Swapping ${selectedItemIds.length} piece${selectedItemIds.length === 1 ? '' : 's'} — the rest of this outfit stays the same.`}
          </AppText>
          <PrimaryButton
            label="Generate Variants"
            variant="secondary"
            disabled={selectedItemIds.length === 0}
            onPress={() => onGenerateVariants(selectedItemIds)}
          />
        </View>
      ) : null}

      {showActions ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {onDelete ? (
            <Pressable onPress={onDelete} style={actionButtonStyle}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                <AppIcon color={theme.colors.danger} name="trash" size={16} />
                <AppText style={{ color: theme.colors.danger }}>Remove</AppText>
              </View>
            </Pressable>
          ) : (
            <>
              {onSave ? (
                <Pressable
                  disabled={isSaved || isSaving}
                  onPress={onSave}
                  style={[actionButtonStyle, { backgroundColor: isSaved ? theme.colors.card : theme.colors.surface }]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                    <AppIcon color={theme.colors.text} name={isSaved ? 'bookmark-filled' : 'bookmark'} size={16} />
                    <AppText>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</AppText>
                  </View>
                </Pressable>
              ) : null}
              {onAddToWeek ? (
                <Pressable onPress={onAddToWeek} style={actionButtonStyle}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                    <AppIcon color={theme.colors.text} name="calendar" size={16} />
                    <AppText>Add to week</AppText>
                  </View>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {onSecondOpinion ? (
        <Pressable
          onPress={onSecondOpinion}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: spacing.md,
          }}>
          <AppIcon color={theme.colors.accent} name="chat" size={16} />
          <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
        </Pressable>
      ) : null}

      {onFeedback ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => onFeedback('love')}
            style={[
              actionButtonStyle,
              outfit.feedback === 'love' ? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent } : null,
            ]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon
                color={outfit.feedback === 'love' ? theme.colors.inverseText : theme.colors.text}
                name="heart"
                size={16}
              />
              <AppText style={{ color: outfit.feedback === 'love' ? theme.colors.inverseText : theme.colors.text }}>
                Love it
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={() => onFeedback('hate')}
            style={[
              actionButtonStyle,
              outfit.feedback === 'hate' ? { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger } : null,
            ]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon
                color={outfit.feedback === 'hate' ? theme.colors.inverseText : theme.colors.text}
                name="thumbs-down"
                size={16}
              />
              <AppText style={{ color: outfit.feedback === 'hate' ? theme.colors.inverseText : theme.colors.text }}>
                Hate it
              </AppText>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const actionButtonStyle = {
  alignItems: 'center' as const,
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 999,
  borderWidth: 1,
  flex: 1,
  justifyContent: 'center' as const,
  minHeight: 44,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
};
