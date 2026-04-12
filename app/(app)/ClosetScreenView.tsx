import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated, FlatList, Modal, Platform, Pressable, ScrollView,
  SectionList, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetItem } from '@/types/closet';
import {
  COLUMN_COUNT, type CategoryEntry, type ClosetRow, type ClosetSection,
} from './closet-grid-utils';

// ── Props ─────────────────────────────────────────────────────────────────────

export type ClosetScreenViewProps = {
  // Data
  isLoading: boolean;
  itemCount: number;
  eligibleItemCount: number;
  categories: CategoryEntry[];
  sections: ClosetSection[];
  // Navigation / filter
  selectedCategory: string | null;
  filteredRows: ClosetRow[];
  filterModalVisible: boolean;
  onFilterPress: () => void;
  onCategorySelect: (cat: string | null) => void;
  onFilterModalClose: () => void;
  // Add item modal
  addModalVisible: boolean;
  onAddPress: () => void;
  onAddModalClose: () => void;
  onNewItemSaved: (item: ClosetItem) => void;
  // Help Me Pick
  onHelpMePickPress: () => void;
  // Grid
  cellWidth: number;
  onPressItem: (item: ClosetItem) => void;
  flatListRef: React.RefObject<FlatList<ClosetRow> | null>;
  sectionListRef: React.RefObject<SectionList<ClosetRow> | null>;
  // Animation
  translateX: Animated.Value;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function ClosetScreenView({
  isLoading,
  itemCount,
  eligibleItemCount,
  categories,
  sections,
  selectedCategory,
  filteredRows,
  filterModalVisible,
  onFilterPress,
  onCategorySelect,
  onFilterModalClose,
  addModalVisible,
  onAddPress,
  onAddModalClose,
  onNewItemSaved,
  onHelpMePickPress,
  cellWidth,
  onPressItem,
  flatListRef,
  sectionListRef,
  translateX,
}: ClosetScreenViewProps) {
  const { theme } = useTheme();
  const activeLabel = selectedCategory ?? 'All Items';

  // renderItem is stable unless cellWidth or onPressItem changes
  const renderRow = useCallback(
    ({ item: row }: { item: ClosetRow }) => (
      <ClosetGridRow row={row} cellWidth={cellWidth} onPressItem={onPressItem} />
    ),
    [cellWidth, onPressItem],
  );

  const listHeaderContent = (
    <View style={{ gap: spacing.xl, paddingBottom: spacing.xs }}>
      {/* Title + add button */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.sm, flex: 1 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">My Closet</AppText>
          <AppText tone="muted">Your catalogued wardrobe pieces.</AppText>
        </View>
        <Pressable
          hitSlop={8}
          onPress={onAddPress}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.accent,
            borderRadius: 999,
            height: 40,
            justifyContent: 'center',
            width: 40,
          }}>
          <Ionicons color="#FFF" name="add" size={22} />
        </Pressable>
      </View>

      {/* Loading bar */}
      {isLoading ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            padding: spacing.xl,
            gap: spacing.md,
            alignItems: 'center',
          }}>
          <View
            style={{
              backgroundColor: theme.colors.border,
              borderRadius: 999,
              height: 10,
              overflow: 'hidden',
              width: '100%',
            }}>
            <Animated.View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                height: '100%',
                transform: [{ translateX }],
                width: 140,
              }}
            />
          </View>
          <AppText tone="muted">Loading your wardrobe...</AppText>
        </View>
      ) : null}

      {/* Category filter */}
      {!isLoading && itemCount > 0 ? (
        <Pressable
          onPress={onFilterPress}
          style={{
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}>
          <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>{activeLabel}</AppText>
          <Ionicons color={theme.colors.mutedText} name="chevron-down" size={14} />
        </Pressable>
      ) : null}

      {/* Help Me Pick */}
      {!isLoading && eligibleItemCount >= 10 ? (
        <Pressable
          onPress={onHelpMePickPress}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 16,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}>
          <Ionicons color={theme.colors.accent} name="sparkles" size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontSize: 14, fontFamily: theme.fonts.sansMedium }}>Help me pick an anchor</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Let a stylist choose your starting piece</AppText>
          </View>
          <Ionicons color={theme.colors.subtleText} name="chevron-forward" size={16} />
        </Pressable>
      ) : !isLoading && eligibleItemCount > 0 && eligibleItemCount < 10 ? (
        <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Add {10 - eligibleItemCount} more top{10 - eligibleItemCount === 1 ? '' : 's'}, bottom{10 - eligibleItemCount === 1 ? '' : 's'}, or outerwear to unlock Help Me Pick
        </AppText>
      ) : null}

      {/* Empty state */}
      {!isLoading && itemCount === 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.md,
            padding: spacing.xl,
          }}>
          <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={40} />
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="sectionTitle">Your closet is empty</AppText>
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              Save pieces from your outfit reviews or piece checks to start cataloguing your wardrobe.
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {selectedCategory ? (
        <FlatList<ClosetRow>
          ref={flatListRef}
          data={filteredRows}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={
            !isLoading ? (
              <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
                No items in this category.
              </AppText>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      ) : (
        <SectionList<ClosetRow>
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingBottom: spacing.md, paddingTop: spacing.xl }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                {title}
              </AppText>
            </View>
          )}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={RowSeparator}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => undefined}
        />
      )}

      <SaveToClosetModal
        visible={addModalVisible}
        onClose={onAddModalClose}
        onSaved={onNewItemSaved}
      />

      <CategoryFilterModal
        visible={filterModalVisible}
        categories={categories}
        selected={selectedCategory}
        onSelect={onCategorySelect}
        onClose={onFilterModalClose}
      />
    </SafeAreaView>
  );
}

// ── RowSeparator ──────────────────────────────────────────────────────────────

const RowSeparator = () => <View style={{ height: spacing.sm }} />;

// ── Grid row ──────────────────────────────────────────────────────────────────

type ClosetGridRowProps = {
  row: ClosetRow;
  cellWidth: number;
  onPressItem: (item: ClosetItem) => void;
};

const ClosetGridRow = React.memo(function ClosetGridRow({ row, cellWidth, onPressItem }: ClosetGridRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {row.map((item) => (
        <ClosetGridItem
          key={item.id}
          item={item}
          cellWidth={cellWidth}
          onPress={onPressItem}
        />
      ))}
      {row.length < COLUMN_COUNT
        ? Array.from({ length: COLUMN_COUNT - row.length }).map((_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))
        : null}
    </View>
  );
});

// ── Grid item ─────────────────────────────────────────────────────────────────

type ClosetGridItemProps = {
  item: ClosetItem;
  cellWidth: number;
  onPress: (item: ClosetItem) => void;
};

const ClosetGridItem = React.memo(function ClosetGridItem({ item, cellWidth, onPress }: ClosetGridItemProps) {
  const { theme } = useTheme();
  const hasBoth = Boolean(item.sketchImageUrl) && Boolean(item.uploadedImageUrl);
  const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1, gap: spacing.xs }} onPress={() => onPress(item)}>
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
          {hasBoth && cellWidth > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: cellWidth, flex: 1 }}>
              <Image contentFit="cover" source={{ uri: item.sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
              <Image contentFit="cover" source={{ uri: item.uploadedImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
            </ScrollView>
          ) : primaryUri ? (
            <Image contentFit="cover" source={{ uri: primaryUri }} style={{ height: '100%', width: '100%' }} />
          ) : item.sketchStatus === 'pending' ? (
            <Ionicons color={theme.colors.subtleText} name="time-outline" size={22} />
          ) : (
            <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={22} />
          )}

          {hasBoth ? (
            <View style={{ bottom: 6, flexDirection: 'row', gap: 4, position: 'absolute', alignSelf: 'center' }}>
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.9 }} />
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.45 }} />
            </View>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, letterSpacing: 0.2 }} numberOfLines={2}>
            {item.title}
          </AppText>
          {item.brand ? (
            <AppText tone="muted" style={{ fontSize: 10 }} numberOfLines={1}>{item.brand}</AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

// ── Category filter modal ─────────────────────────────────────────────────────

type CategoryFilterModalProps = {
  visible: boolean;
  categories: CategoryEntry[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  onClose: () => void;
};

function CategoryFilterModal({ visible, categories, selected, onSelect, onClose }: CategoryFilterModalProps) {
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
