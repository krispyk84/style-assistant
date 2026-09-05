import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ClosetOutfitDetailModal } from '@/components/cards/closet-outfit-detail-modal';
import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { outfitChatFlow } from '@/lib/outfit-chat-flow';
import { buildSecondOpinionSubjectFromClosetOutfit } from '@/lib/outfit-utils';
import type { ClosetGeneratedOutfit } from '@/types/api';
import { OutfitActionsAccordion } from './OutfitActionsAccordion';
import { OutfitItemThumbnailRow } from './OutfitItemThumbnailRow';

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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const showActions = onSave || onAddToWeek || onDelete;

  function toggleItemSelected(itemId: string) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= MAX_SWAP_SELECTION) return current;
      return [...current, itemId];
    });
  }

  const quietButtonStyle = { alignItems: 'center' as const, backgroundColor: theme.colors.subtleSurface, borderRadius: 999, flex: 1, justifyContent: 'center' as const, minHeight: 44, paddingHorizontal: spacing.sm };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <View style={{ gap: 2, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.accent }}>From Your Closet</AppText>
        <AppText variant="display">{outfit.title}</AppText>
      </View>

      <Pressable onPress={() => setIsDetailOpen(true)}>
        <GeneratedSketchPanel
          mode="compact"
          status={outfit.sketchStatus}
          imageUrl={outfit.sketchImageUrl}
          pendingTitle="Sketching this outfit..."
          pendingMessage="The illustration will appear automatically when it's ready."
          failedLabel="Sketch unavailable"
        />
      </Pressable>

      <ClosetOutfitDetailModal visible={isDetailOpen} outfit={outfit} onClose={() => setIsDetailOpen(false)} />

      <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Why This Works</AppText>
        <AppText tone="muted">{outfit.whyItWorks}</AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>The Pieces</AppText>
      <OutfitItemThumbnailRow
        items={outfit.items.map((item) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.sketchImageUrl ?? item.uploadedImageUrl,
        }))}
        selectedItemIds={onGenerateVariants ? selectedItemIds : undefined}
        onToggleSelect={onGenerateVariants ? toggleItemSelected : undefined}
      />
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

      <OutfitActionsAccordion>
          {showActions ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {onDelete ? (
                <Pressable onPress={onDelete} style={quietButtonStyle}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                    <AppIcon color={theme.colors.danger} name="trash" size={16} />
                    <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>Remove</AppText>
                  </View>
                </Pressable>
              ) : (
                <>
                  {onSave ? (
                    <Pressable
                      disabled={isSaved || isSaving}
                      onPress={onSave}
                      style={[quietButtonStyle, isSaved ? { backgroundColor: theme.colors.border } : null]}>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                        <AppIcon color={theme.colors.text} name={isSaved ? 'bookmark-filled' : 'bookmark'} size={16} />
                        <AppText style={{ fontSize: 13 }}>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</AppText>
                      </View>
                    </Pressable>
                  ) : null}
                  {onAddToWeek ? (
                    <Pressable onPress={onAddToWeek} style={quietButtonStyle}>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
                        <AppIcon color={theme.colors.text} name="calendar" size={16} />
                        <AppText style={{ fontSize: 13 }}>Add to week</AppText>
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
                minHeight: 50,
                paddingHorizontal: spacing.md,
              }}>
              <AppIcon color={theme.colors.accent} name="chat" size={18} />
              <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              outfitChatFlow.setPendingContext({
                ...buildSecondOpinionSubjectFromClosetOutfit(outfit),
                sketchImageUrl: outfit.sketchImageUrl,
              });
              router.push('/outfit-chat');
            }}
            style={{
              alignItems: 'center',
              borderColor: theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              gap: spacing.xs,
              justifyContent: 'center',
              minHeight: 50,
              paddingHorizontal: spacing.md,
            }}>
            <AppIcon color={theme.colors.text} name="chat" size={18} />
            <AppText>Ask Questions</AppText>
          </Pressable>
      </OutfitActionsAccordion>

      {onFeedback ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => onFeedback('love')}
            style={[quietButtonStyle, outfit.feedback === 'love' ? { backgroundColor: theme.colors.text } : null]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon
                color={outfit.feedback === 'love' ? theme.colors.inverseText : theme.colors.text}
                name="heart"
                size={16}
              />
              <AppText style={{ color: outfit.feedback === 'love' ? theme.colors.inverseText : theme.colors.text, fontSize: 13 }}>
                Love it
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={() => onFeedback('hate')}
            style={[quietButtonStyle, outfit.feedback === 'hate' ? { backgroundColor: theme.colors.text } : null]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon
                color={outfit.feedback === 'hate' ? theme.colors.inverseText : theme.colors.text}
                name="thumbs-down"
                size={16}
              />
              <AppText style={{ color: outfit.feedback === 'hate' ? theme.colors.inverseText : theme.colors.text, fontSize: 13 }}>
                Hate it
              </AppText>
            </View>
          </Pressable>
        </View>
      ) : null}
      </View>
    </View>
  );
}
