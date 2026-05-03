import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { CategoryEntry } from '@/app/(app)/closet-grid-utils';

// ── Props ─────────────────────────────────────────────────────────────────────

export type CategoryFilterModalProps = {
  visible: boolean;
  categories: CategoryEntry[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  onClose: () => void;
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export function CategoryFilterModal({ visible, categories, selected, onSelect, onClose }: CategoryFilterModalProps) {
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const itemYOffsets = useRef<number[]>([]);
  const filterRowStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  } as const;
  const filterRowActiveStyle = { borderColor: theme.colors.accent } as const;

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      const idx = selected === null ? 0 : (categories.findIndex((c) => c.label === selected) + 1);
      const y = itemYOffsets.current[idx] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: false });
    }, 50);
    return () => clearTimeout(timeout);
  }, [visible, selected, categories]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.overlay,
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        {/* Stop taps on the card from closing the modal */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: 28,
            maxWidth: 420,
            overflow: 'hidden',
            width: '100%',
          }}>
          {/* Fixed header */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Filter by Category
            </AppText>
          </View>

          {/* Scrollable category list — capped so it never overflows the screen */}
          <ScrollView
            ref={scrollRef}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: screenHeight * 0.52 }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Pressable
              onLayout={(e) => { itemYOffsets.current[0] = e.nativeEvent.layout.y; }}
              onPress={() => onSelect(null)}
              style={[filterRowStyle, !selected ? filterRowActiveStyle : null]}>
              <AppText variant="sectionTitle" style={!selected ? { color: theme.colors.accent } : undefined}>All Items</AppText>
              <AppText tone="muted">{categories.reduce((sum, c) => sum + c.count, 0)}</AppText>
            </Pressable>

            {categories.map((cat, idx) => (
              <Pressable
                key={cat.label}
                onLayout={(e) => { itemYOffsets.current[idx + 1] = e.nativeEvent.layout.y; }}
                onPress={() => onSelect(cat.label)}
                style={[filterRowStyle, selected === cat.label ? filterRowActiveStyle : null]}>
                <AppText variant="sectionTitle" style={selected === cat.label ? { color: theme.colors.accent } : undefined}>
                  {cat.label}
                </AppText>
                <AppText tone="muted">{cat.count}</AppText>
              </Pressable>
            ))}
          </ScrollView>

          {/* Fixed footer */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
            <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
