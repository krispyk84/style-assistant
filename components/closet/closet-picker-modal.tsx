import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { BottomSheetModal } from '@/components/ui/bottom-sheet-modal';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetItem } from '@/types/closet';

type ClosetPickerModalProps = {
  visible: boolean;
  items: ClosetItem[];
  onSelect: (item: ClosetItem) => void;
  onClose: () => void;
};

/**
 * Bottom-sheet picker for selecting a single closet item.
 * Includes a category filter row and a 3-column image grid.
 * Reused in New Style Brief and the Check Piece flow.
 */
export function ClosetPickerModal({ visible, items, onSelect, onClose }: ClosetPickerModalProps) {
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(items.map((i) => i.category))].sort();
  const displayItems = selectedCategory ? items.filter((i) => i.category === selectedCategory) : items;

  const rows: ClosetItem[][] = [];
  for (let i = 0; i < displayItems.length; i += 3) rows.push(displayItems.slice(i, i + 3));

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight={screenHeight * 0.82}>
      {/* Header */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: spacing.lg,
          paddingBottom: spacing.md,
        }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
          Select from Closet
        </AppText>
        <Pressable hitSlop={8} onPress={onClose}>
          <AppIcon color={theme.colors.mutedText} name="close" size={22} />
        </Pressable>
      </View>

      {/* Category filter pills */}
      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              pillStyle(theme),
              !selectedCategory ? pillActiveStyle(theme) : null,
            ]}>
            <AppText style={{ fontSize: 12, color: !selectedCategory ? '#FFF' : theme.colors.text }}>
              All
            </AppText>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                pillStyle(theme),
                selectedCategory === cat ? pillActiveStyle(theme) : null,
              ]}>
              <AppText style={{ fontSize: 12, color: selectedCategory === cat ? '#FFF' : theme.colors.text }}>
                {cat}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Item grid */}
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, padding: spacing.lg }}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((item) => (
              <Pressable key={item.id} onPress={() => onSelect(item)} style={{ flex: 1, gap: spacing.xs }}>
                <View
                  style={{
                    aspectRatio: 3 / 4,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {item.sketchImageUrl ?? item.uploadedImageUrl ? (
                    <Image
                      contentFit="cover"
                      source={{ uri: (item.sketchImageUrl ?? item.uploadedImageUrl)! }}
                      style={{ height: '100%', width: '100%' }}
                    />
                  ) : (
                    <AppIcon color={theme.colors.subtleText} name="shirt" size={22} />
                  )}
                </View>
                <AppText
                  numberOfLines={2}
                  style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, letterSpacing: 0.2 }}>
                  {item.title}
                </AppText>
              </Pressable>
            ))}
            {row.length < 3
              ? Array.from({ length: 3 - row.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ flex: 1 }} />
                ))
              : null}
          </View>
        ))}
      </ScrollView>
    </BottomSheetModal>
  );
}

function pillStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as const;
}

function pillActiveStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  } as const;
}
