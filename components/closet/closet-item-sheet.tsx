import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { ClosetItem } from '@/types/closet';

type ClosetItemSheetProps = {
  item: ClosetItem | null;
  onClose: () => void;
  /** True while a rematch is in flight — shows a loading spinner instead of item content. */
  isRematching?: boolean;
  /** Pre-set thumb value for this specific match (persisted). */
  thumbsFeedback?: 'up' | 'down' | null;
  /** Called when thumbs-up is tapped. Sheet stays open. */
  onThumbsUp?: () => void;
  /** Called when thumbs-down is tapped. Sheet stays open while rematching. */
  onThumbsDown?: () => void;
};

/**
 * Read-only bottom sheet for previewing a matched closet item.
 * Includes per-match thumbs feedback when callbacks are provided.
 * Stays open during rematch — shows a spinner while loading, then the new item.
 */
export function ClosetItemSheet({
  item,
  onClose,
  isRematching = false,
  thumbsFeedback = null,
  onThumbsUp,
  onThumbsDown,
}: ClosetItemSheetProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;
  const [localThumb, setLocalThumb] = useState<'up' | 'down' | null>(thumbsFeedback);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset thumbs state when the matched item changes (e.g. after a rematch)
  useEffect(() => {
    setLocalThumb(thumbsFeedback ?? null);
  // item?.id changing means a new item was slotted in
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, thumbsFeedback]);

  function dismissAndClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 800, duration: 240, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  function handleThumbsUp() {
    const next = localThumb === 'up' ? null : 'up';
    setLocalThumb(next);
    if (next === 'up') onThumbsUp?.();
  }

  function handleThumbsDown() {
    if (localThumb === 'down' || isRematching) return;
    setLocalThumb('down');
    onThumbsDown?.();
    // Sheet stays open — parent will update `item` and `isRematching` as the rematch runs
  }

  const hasFeedback = onThumbsUp !== undefined || onThumbsDown !== undefined;

  return (
    <Modal animationType="none" transparent visible onRequestClose={dismissAndClose}>
      {/* Backdrop — opacity only, never slides */}
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(24, 18, 14, 0.52)',
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            backgroundColor: '#FFFDFC',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '80%',
            overflow: 'hidden',
            transform: [{ translateY: sheetTranslateY }],
          }}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>

            {/* Header */}
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                <Ionicons color={theme.colors.accent} name="checkmark-circle" size={16} />
                <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                  In Your Closet
                </AppText>
              </View>
              <Pressable hitSlop={8} onPress={dismissAndClose}>
                <Ionicons color={theme.colors.mutedText} name="close" size={22} />
              </Pressable>
            </View>

            {/* Item image / loading / no-match */}
            <View
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                height: 240,
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
              {isRematching ? (
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator color={theme.colors.accent} size="large" />
                  <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                    Finding a better match...
                  </AppText>
                </View>
              ) : item === null ? (
                <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                  <Ionicons color={theme.colors.subtleText} name="search-outline" size={32} />
                  <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
                    No suitable match could be found.
                  </AppText>
                </View>
              ) : (() => {
                const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;
                if (primaryUri) {
                  return (
                    <Image
                      contentFit="contain"
                      source={{ uri: primaryUri }}
                      style={{ height: '100%', width: '100%' }}
                    />
                  );
                }
                if (item.sketchStatus === 'pending') {
                  return (
                    <View style={{ alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons color={theme.colors.subtleText} name="time-outline" size={32} />
                      <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>
                        Sketch generating...
                      </AppText>
                    </View>
                  );
                }
                return <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={40} />;
              })()}
            </View>

            {/* Item details — hidden while rematching or when no match */}
            {!isRematching && item !== null ? (
              <View style={{ gap: spacing.md }}>
                <LabelRow label="Title" value={item.title} />
                <LabelRow label="Category" value={item.category} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <LabelRow label="Brand" value={item.brand || '—'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabelRow label="Size" value={item.size || '—'} />
                  </View>
                </View>
              </View>
            ) : null}

            {/* Per-match thumbs feedback — only shown when callbacks are provided and not rematching */}
            {hasFeedback && !isRematching && item !== null ? (
              <View style={styles.thumbsRow}>
                <AppText tone="muted" style={styles.thumbsLabel}>Was this a good match?</AppText>
                <Pressable
                  hitSlop={8}
                  onPress={handleThumbsUp}
                  style={[styles.thumbBtn, localThumb === 'up' && styles.thumbBtnUp]}>
                  <Ionicons
                    color={localThumb === 'up' ? theme.colors.accent : theme.colors.mutedText}
                    name={localThumb === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={16}
                  />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={handleThumbsDown}
                  style={[styles.thumbBtn, localThumb === 'down' && styles.thumbBtnDown]}>
                  <Ionicons
                    color={localThumb === 'down' ? theme.colors.danger : theme.colors.mutedText}
                    name={localThumb === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                    size={16}
                  />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LabelRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
        {label}
      </AppText>
      <AppText style={{ color: theme.colors.text, fontFamily: theme.fonts.sans, fontSize: 15 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  thumbsLabel: { flex: 1, fontSize: 13 },
  thumbBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumbBtnUp: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.accent,
  },
  thumbBtnDown: {
    backgroundColor: theme.colors.dangerSurface,
    borderColor: theme.colors.danger,
  },
});
